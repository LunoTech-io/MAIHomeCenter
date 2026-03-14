import { Router } from 'express'
import alertService from '../services/alertService.js'
import { authenticateAdmin } from '../middleware/authMiddleware.js'

const router = Router()

// All endpoints require admin auth
router.use(authenticateAdmin)

// GET /api/alerts/house-summary - Alert counts by house for today/week
router.get('/house-summary', async (req, res) => {
  try {
    const org = req.admin.organization
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1).toISOString()

    const result = await alertService.getHouseAlertSummary(org, startOfDay, startOfWeek)
    res.json(result)
  } catch (error) {
    console.error('Error fetching house alert summary:', error)
    res.status(500).json({ error: 'Failed to fetch house alert summary' })
  }
})

// GET /api/alerts/rules - List rules for admin's organization
router.get('/rules', async (req, res) => {
  try {
    const rules = await alertService.getRulesByOrganization(req.admin.organization)
    res.json(rules)
  } catch (error) {
    console.error('Error fetching alert rules:', error)
    res.status(500).json({ error: 'Failed to fetch alert rules' })
  }
})

// GET /api/alerts/rules/:id - Get single rule
router.get('/rules/:id', async (req, res) => {
  try {
    const rule = await alertService.getRuleById(req.params.id)

    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' })
    }

    if (rule.organization !== req.admin.organization) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json(rule)
  } catch (error) {
    console.error('Error fetching alert rule:', error)
    res.status(500).json({ error: 'Failed to fetch alert rule' })
  }
})

// POST /api/alerts/rules - Create rule
router.post('/rules', async (req, res) => {
  try {
    const { name, conditions, sustainedMinutes, notificationTitle, notificationBody, isActive } = req.body

    if (!name || !conditions || !notificationTitle || !notificationBody) {
      return res.status(400).json({ error: 'Name, conditions, notification title, and notification body are required' })
    }

    const rule = await alertService.createRule({
      organization: req.admin.organization,
      name,
      conditions,
      sustainedMinutes,
      notificationTitle,
      notificationBody,
      isActive,
      createdBy: req.admin.id
    })

    res.status(201).json(rule)
  } catch (error) {
    if (error.message.includes('Invalid') || error.message.includes('required')) {
      return res.status(400).json({ error: error.message })
    }
    console.error('Error creating alert rule:', error)
    res.status(500).json({ error: 'Failed to create alert rule' })
  }
})

// PUT /api/alerts/rules/:id - Update rule
router.put('/rules/:id', async (req, res) => {
  try {
    const existing = await alertService.getRuleById(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Alert rule not found' })
    }
    if (existing.organization !== req.admin.organization) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const { name, conditions, sustainedMinutes, notificationTitle, notificationBody, isActive } = req.body

    const rule = await alertService.updateRule(req.params.id, {
      name,
      conditions,
      sustainedMinutes,
      notificationTitle,
      notificationBody,
      isActive
    })

    res.json(rule)
  } catch (error) {
    if (error.message.includes('Invalid') || error.message.includes('required')) {
      return res.status(400).json({ error: error.message })
    }
    console.error('Error updating alert rule:', error)
    res.status(500).json({ error: 'Failed to update alert rule' })
  }
})

// DELETE /api/alerts/rules/:id - Delete rule (cascades state)
router.delete('/rules/:id', async (req, res) => {
  try {
    const existing = await alertService.getRuleById(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Alert rule not found' })
    }
    if (existing.organization !== req.admin.organization) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await alertService.deleteRule(req.params.id)
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting alert rule:', error)
    res.status(500).json({ error: 'Failed to delete alert rule' })
  }
})

export default router
