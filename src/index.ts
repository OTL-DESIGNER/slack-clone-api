import express from 'express'
import dotenv from 'dotenv'
import connectDB from './config/db'
import cors from 'cors'
import auth from './routes/auth'
import channel from './routes/channel'
import message from './routes/message'
import thread from './routes/thread'
import teammates from './routes/teammates'
import organisation from './routes/organisation'
import conversations from './routes/conversations'

dotenv.config()

const app = express()

// Connect to MongoDB
connectDB()

// Basic middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// CORS configuration
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

// API Routes
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

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

// Start server
const port = Number(process.env.PORT) || 8081
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`)
})

export default app
