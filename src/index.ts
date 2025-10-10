import express from 'express'
import dotenv from 'dotenv'
import connectDB from './config/db'
dotenv.config()
import auth from './routes/auth'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import xss from 'xss-clean'
import rateLimit from 'express-rate-limit'
import hpp from 'hpp'
import cors from 'cors'
import channel from './routes/channel'
import message from './routes/message'
import thread from './routes/thread'
import teammates from './routes/teammates'
import organisation from './routes/organisation'
import conversations from './routes/conversations'
import Message from '../src/models/message'
import Channels from '../src/models/channel'
import Conversations from './models/conversation'
import { Server } from 'socket.io'
import http from 'http'
import updateConversationStatus from './helpers/updateConversationStatus'
import Thread from './models/thread'
import createTodaysFirstMessage from './helpers/createTodaysFirstMessage'
import passport from 'passport'
import cookieSession from 'cookie-session'

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
})

// Connect to MongoDB
connectDB()

// Express configuration
app.use(
  cookieSession({
    name: 'session',
    keys: ['cyberwolve'],
    maxAge: 24 * 60 * 60 * 100,
  }),
)

app.use(passport.initialize())
app.use(passport.session())

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// cookie-parser configuration
app.use(cookieParser())

// Set security headers
app.use(helmet())

// Prevent XSS attacks
app.use(xss())

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 1000,
})
app.use(limiter)

// Prevent http param pollution
app.use(hpp())

// Enable CORS
app.use(
  cors({
    origin: [
      'https://slack-clone-client-tan.vercel.app',
      'http://localhost:3000',
      process.env.CLIENT_URL,
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  }),
)

// Store users' sockets by their user IDs
const users = {}

// Set up WebSocket connections
io.on('connection', (socket) => {
  socket.on('user-join', async ({ id, isOnline }) => {
    socket.join(id)
    await updateConversationStatus(id, isOnline)
    io.emit('user-join', { id, isOnline })
  })

  socket.on('user-leave', async ({ id, isOnline }) => {
    socket.leave(id)
    await updateConversationStatus(id, isOnline)
    io.emit('user-leave', { id, isOnline })
  })

  socket.on('channel-open', async ({ id, userId }) => {
    if (id) {
      socket.join(id)
      const updatedChannel = await Channels.findByIdAndUpdate(
        id,
        { $pull: { hasNotOpen: userId } },
        { new: true },
      )
      io.to(id).emit('channel-updated', updatedChannel)
    }
  })
  socket.on('convo-open', async ({ id, userId }) => {
    if (id) {
      socket.join(id)
      const updatedConversation = await Conversations.findByIdAndUpdate(
        id,
        { $pull: { hasNotOpen: userId } },
        { new: true },
      )
      io.to(id).emit('convo-updated', updatedConversation)
    }
  })

  socket.on('thread-message', async ({ userId, messageId, message }) => {
    try {
      socket.join(messageId)
      let newMessage = await Thread.create({
        sender: message.sender,
        content: message.content,
        message: messageId,
        hasRead: false,
      })
      newMessage = await newMessage.populate('sender')
      io.to(messageId).emit('thread-message', { newMessage })
      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        {
          threadLastReplyDate: newMessage.createdAt,
          $addToSet: { threadReplies: userId },
          $inc: { threadRepliesCount: 1 },
        },
        { new: true },
      ).populate(['threadReplies', 'sender', 'reactions.reactedToBy'])

      io.to(messageId).emit('message-updated', {
        id: messageId,
        message: updatedMessage,
      })
    } catch (error) {
      // Minimal error logging to prevent floods
    }
  })

  socket.on(
    'message',
    async ({
      channelId,
      channelName,
      conversationId,
      collaborators,
      isSelf,
      message,
      organisation,
      hasNotOpen,
    }) => {
      try {
        if (channelId) {
          socket.join(channelId)
          await createTodaysFirstMessage({ channelId, organisation })

          let newMessage = await Message.create({
            organisation,
            sender: message.sender,
            content: message.content,
            channel: channelId,
            hasRead: false,
          })

          newMessage = await newMessage.populate('sender')
          io.to(channelId).emit('message', { newMessage, organisation })

          const updatedChannel = await Channels.findByIdAndUpdate(
            channelId,
            { hasNotOpen },
            { new: true },
          )

          io.to(channelId).emit('channel-updated', updatedChannel)
          socket.broadcast.emit('notification', {
            channelName,
            channelId,
            collaborators,
            newMessage,
            organisation,
          })
        } else if (conversationId) {
          socket.join(conversationId)
          await createTodaysFirstMessage({ conversationId, organisation })
          let newMessage = await Message.create({
            organisation,
            sender: message.sender,
            content: message.content,
            conversation: conversationId,
            collaborators,
            isSelf,
            hasRead: false,
          })
          newMessage = await newMessage.populate('sender')

          io.to(conversationId).emit('message', {
            collaborators,
            organisation,
            newMessage,
          })
          const updatedConversation = await Conversations.findByIdAndUpdate(
            conversationId,
            { hasNotOpen },
            { new: true },
          )
          io.to(conversationId).emit('convo-updated', updatedConversation)
          socket.broadcast.emit('notification', {
            collaborators,
            organisation,
            newMessage,
            conversationId,
          })
        }
      } catch (error) {
        // Minimal error logging to prevent floods
      }
    },
  )

  socket.on('message-view', async (messageId) => {
    await Message.findByIdAndUpdate(messageId, {
      hasRead: true,
    })
    io.emit('message-view', messageId)
  })

  socket.on('reaction', async ({ emoji, id, isThread, userId }) => {
    let message
    if (isThread) {
      message = await Thread.findById(id)
    } else {
      message = await Message.findById(id)
    }

    if (!message) {
      return
    }

    if (message.reactions.some((r) => r.emoji === emoji)) {
      if (
        message.reactions.some(
          (r) =>
            r.emoji === emoji &&
            r.reactedToBy.some((v) => v.toString() === userId),
        )
      ) {
        const reactionToUpdate = message.reactions.find(
          (r) => r.emoji === emoji,
        )
        if (reactionToUpdate) {
          reactionToUpdate.reactedToBy = reactionToUpdate.reactedToBy.filter(
            (v) => v.toString() !== userId,
          )

          if (reactionToUpdate.reactedToBy.length === 0) {
            message.reactions = message.reactions.filter(
              (r) => r !== reactionToUpdate,
            )
          }
          if (isThread) {
            await message.populate(['reactions.reactedToBy', 'sender'])
          } else {
            await message.populate([
              'reactions.reactedToBy',
              'sender',
              'threadReplies',
            ])
          }
          socket.emit('message-updated', { id, message, isThread })
          await message.save()
        }
      } else {
        const reactionToUpdate = message.reactions.find(
          (r) => r.emoji === emoji,
        )
        if (reactionToUpdate) {
          reactionToUpdate.reactedToBy.push(userId)
          if (isThread) {
            await message.populate(['reactions.reactedToBy', 'sender'])
          } else {
            await message.populate([
              'reactions.reactedToBy',
              'sender',
              'threadReplies',
            ])
          }
          socket.emit('message-updated', { id, message, isThread })
          await message.save()
        }
      }
    } else {
      message.reactions.push({ emoji, reactedToBy: [userId] })
      if (isThread) {
        await message.populate(['reactions.reactedToBy', 'sender'])
      } else {
        await message.populate([
          'reactions.reactedToBy',
          'sender',
          'threadReplies',
        ])
      }
      socket.emit('message-updated', { id, message, isThread })
      await message.save()
    }
  })

  socket.on('join-room', ({ roomId, userId }) => {
    socket.join(roomId)
    users[userId] = socket
    socket.to(roomId).emit('join-room', { roomId, otherUserId: userId })
  })

  socket.on('offer', ({ offer, targetUserId }) => {
    const targetSocket = users[targetUserId]
    if (targetSocket) {
      targetSocket.emit('offer', { offer, senderUserId: targetUserId })
    }
  })

  socket.on('answer', ({ answer, senderUserId }) => {
    socket.broadcast.emit('answer', { answer, senderUserId })
  })

  socket.on('ice-candidate', ({ candidate, senderUserId }) => {
    const targetSocket = users[senderUserId]
    if (targetSocket) {
      targetSocket.emit('ice-candidate', candidate, senderUserId)
    }
  })

  socket.on('room-leave', ({ roomId, userId }) => {
    socket.leave(roomId)
    delete users[userId]
    socket.to(roomId).emit('room-leave', { roomId, leftUserId: userId })
  })
})

// Health check route
app.get('/', (req, res) => {
  res.json({
    message: 'Slack Clone API is running!',
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/v1/auth/*',
      channels: '/api/v1/channel/*',
      messages: '/api/v1/messages/*',
      threads: '/api/v1/threads/*',
      teammates: '/api/v1/teammates/*',
      organisation: '/api/v1/organisation/*',
      conversations: '/api/v1/conversations/*',
    },
  })
})

// Routes
app.use('/api/v1/auth', auth)
app.use('/api/v1/channel', channel)
app.use('/api/v1/messages', message)
app.use('/api/v1/threads', thread)
app.use('/api/v1/teammates', teammates)
app.use('/api/v1/organisation', organisation)
app.use('/api/v1/conversations', conversations)

// Simple error handler
app.use((error: any, req: any, res: any, next: any) => {
  res.status(500).json({ name: 'Internal Server Error' })
})

// Start the server
const port = Number(process.env.PORT) || 8081
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`)
})

export default server
