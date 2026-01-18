import { Router } from 'express'
import authService from '../services/authService.js'
import { authenticateToken } from '../middleware/authMiddleware.js'

const router = Router()

// POST /api/auth/login - Tenant login
router.post('/login', async (req, res) => {
  try {
    const { houseId, password } = req.body

    if (!houseId || !password) {
      return res.status(400).json({ error: 'House ID and password are required' })
    }

    const result = await authService.login(houseId, password)
    res.json(result)
  } catch (error) {
    console.error('Login error:', error)
    res.status(401).json({ error: error.message || 'Login failed' })
  }
})

// GET /api/auth/me - Get current house info (requires auth)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const house = await authService.getHouseById(req.house.id)

    if (!house) {
      return res.status(404).json({ error: 'House not found' })
    }

    res.json(house)
  } catch (error) {
    console.error('Get house error:', error)
    res.status(500).json({ error: 'Failed to get house info' })
  }
})

export default router
