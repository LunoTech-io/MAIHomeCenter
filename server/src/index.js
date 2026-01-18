import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import notificationRoutes from './routes/notifications.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_URL,
    process.env.ADMIN_URL
  ].filter(Boolean)
}))
app.use(express.json())

// Routes
app.use('/api', notificationRoutes)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server on all network interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
  console.log(`VAPID public key available at: http://localhost:${PORT}/api/vapid-public-key`)
})
