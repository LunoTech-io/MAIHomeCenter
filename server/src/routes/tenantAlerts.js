import { Router } from 'express'
import { authenticateToken } from '../middleware/authMiddleware.js'
import { query } from '../db/index.js'

const router = Router()

router.use(authenticateToken)

// GET /api/my-alerts - Get recent alert notifications for current house
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, rule_id, room_name, title, body, is_read, created_at
       FROM alert_notifications
       WHERE house_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.house.houseId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching alert notifications:', error)
    res.status(500).json({ error: 'Failed to fetch alert notifications' })
  }
})

// PATCH /api/my-alerts/:id/read - Mark a single alert as read
router.patch('/:id/read', async (req, res) => {
  try {
    const result = await query(
      `UPDATE alert_notifications SET is_read = TRUE
       WHERE id = $1 AND house_id = $2
       RETURNING id`,
      [req.params.id, req.house.houseId]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' })
    }
    res.json({ success: true })
  } catch (error) {
    console.error('Error marking alert as read:', error)
    res.status(500).json({ error: 'Failed to mark alert as read' })
  }
})

// POST /api/my-alerts/mark-all-read - Mark all alerts as read
router.post('/mark-all-read', async (req, res) => {
  try {
    await query(
      `UPDATE alert_notifications SET is_read = TRUE
       WHERE house_id = $1 AND is_read = FALSE`,
      [req.house.houseId]
    )
    res.json({ success: true })
  } catch (error) {
    console.error('Error marking all alerts as read:', error)
    res.status(500).json({ error: 'Failed to mark all alerts as read' })
  }
})

export default router
