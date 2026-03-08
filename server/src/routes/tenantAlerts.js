import { Router } from 'express'
import { authenticateToken } from '../middleware/authMiddleware.js'
import { query } from '../db/index.js'

const router = Router()

router.use(authenticateToken)

// GET /api/my-alerts - Get recent alert notifications for current house
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, rule_id, room_name, title, body, created_at
       FROM alert_notifications
       WHERE house_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.house.houseId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching alert notifications:', error)
    res.status(500).json({ error: 'Failed to fetch alert notifications' })
  }
})

export default router
