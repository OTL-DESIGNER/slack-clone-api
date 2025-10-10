import express from 'express'
import {
  googleCallback,
  register,
  signin,
  verify,
  generateProductionToken,
} from '../controllers/auth'
import passport from 'passport'

const router = express.Router()

router.post('/register', register)
router.post('/signin', signin)
router.post('/verify', verify)
router.get('/google', passport.authenticate('google', ['profile', 'email']))

router.get('/google/callback', googleCallback)
router.post('/generate-production-token', generateProductionToken)

export default router
