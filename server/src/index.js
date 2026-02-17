import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import notificationRoutes from './routes/notifications.js'
import authRoutes from './routes/auth.js'
import surveyRoutes from './routes/surveys.js'
import tenantSurveyRoutes from './routes/tenantSurveys.js'
import twinRoutes from './routes/twin.js'
import { getPool } from './db/index.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'https://maihome.nl',
  'https://www.maihome.nl',
  'https://admin.maihome.nl',
  process.env.CLIENT_URL,
  process.env.ADMIN_URL
].filter(Boolean)

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())

// Routes
app.use('/api', notificationRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/surveys', surveyRoutes)
app.use('/api/my-surveys', tenantSurveyRoutes)
app.use('/api/twin', twinRoutes)

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbPool = getPool()
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbPool ? 'connected' : 'not configured'
  })
})

// Start server on all network interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
  console.log(`VAPID public key available at: http://localhost:${PORT}/api/vapid-public-key`)

  // Check database connection
  const pool = getPool()
  if (pool) {
    console.log('PostgreSQL database configured')
  } else {
    console.warn('DATABASE_URL not configured - survey features will be unavailable')
  }
})
