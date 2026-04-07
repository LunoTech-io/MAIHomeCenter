import { Router } from 'express'
import surveyService from '../services/surveyService.js'
import surveyTriggerService from '../services/surveyTriggerService.js'
import authService from '../services/authService.js'
import pushService from '../services/pushService.js'
import { authenticateAdmin } from '../middleware/authMiddleware.js'

const router = Router()

// =====================
// Question Sets
// =====================

// GET /api/surveys/question-sets - List all question sets
router.get('/question-sets', async (req, res) => {
  try {
    const questionSets = await surveyService.getQuestionSets()
    res.json(questionSets)
  } catch (error) {
    console.error('Error fetching question sets:', error)
    res.status(500).json({ error: 'Failed to fetch question sets' })
  }
})

// GET /api/surveys/question-sets/:id - Get single question set with questions
router.get('/question-sets/:id', async (req, res) => {
  try {
    const questionSet = await surveyService.getQuestionSetWithQuestions(req.params.id)

    if (!questionSet) {
      return res.status(404).json({ error: 'Question set not found' })
    }

    res.json(questionSet)
  } catch (error) {
    console.error('Error fetching question set:', error)
    res.status(500).json({ error: 'Failed to fetch question set' })
  }
})

// POST /api/surveys/question-sets - Create question set
router.post('/question-sets', async (req, res) => {
  try {
    const { title, description, notificationTitle, notificationBody, notificationUrl, expiresAt, isDismissable, questions } = req.body

    if (!title || !notificationTitle || !notificationBody) {
      return res.status(400).json({ error: 'Title, notification title, and notification body are required' })
    }

    const questionSet = await surveyService.createQuestionSet({
      title,
      description,
      notificationTitle,
      notificationBody,
      notificationUrl,
      expiresAt,
      isDismissable
    })

    // Add questions if provided
    if (questions && Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        await surveyService.addQuestion(questionSet.id, {
          ...q,
          orderIndex: q.orderIndex ?? i
        })
      }
    }

    const result = await surveyService.getQuestionSetWithQuestions(questionSet.id)
    res.status(201).json(result)
  } catch (error) {
    console.error('Error creating question set:', error)
    res.status(500).json({ error: 'Failed to create question set' })
  }
})

// PUT /api/surveys/question-sets/:id - Update question set
router.put('/question-sets/:id', async (req, res) => {
  try {
    const { title, description, notificationTitle, notificationBody, notificationUrl, expiresAt, isDismissable, isActive, questions } = req.body

    const existing = await surveyService.getQuestionSetById(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Question set not found' })
    }

    await surveyService.updateQuestionSet(req.params.id, {
      title,
      description,
      notificationTitle,
      notificationBody,
      notificationUrl,
      expiresAt,
      isDismissable,
      isActive
    })

    // Update questions if provided
    if (questions && Array.isArray(questions)) {
      // Get existing questions
      const existingQuestions = await surveyService.getQuestionsBySetId(req.params.id)
      const existingIds = new Set(existingQuestions.map(q => q.id))
      const newIds = new Set(questions.filter(q => q.id).map(q => q.id))

      // Delete removed questions
      for (const eq of existingQuestions) {
        if (!newIds.has(eq.id)) {
          await surveyService.deleteQuestion(eq.id)
        }
      }

      // Update or create questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        if (q.id && existingIds.has(q.id)) {
          await surveyService.updateQuestion(q.id, { ...q, orderIndex: q.orderIndex ?? i })
        } else {
          await surveyService.addQuestion(req.params.id, { ...q, orderIndex: q.orderIndex ?? i })
        }
      }
    }

    const result = await surveyService.getQuestionSetWithQuestions(req.params.id)
    res.json(result)
  } catch (error) {
    console.error('Error updating question set:', error)
    res.status(500).json({ error: 'Failed to update question set' })
  }
})

// DELETE /api/surveys/question-sets/:id - Delete question set
router.delete('/question-sets/:id', async (req, res) => {
  try {
    const deleted = await surveyService.deleteQuestionSet(req.params.id)

    if (!deleted) {
      return res.status(404).json({ error: 'Question set not found' })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting question set:', error)
    res.status(500).json({ error: 'Failed to delete question set' })
  }
})

// GET /api/surveys/question-sets/:id/responses - Get responses for a question set
router.get('/question-sets/:id/responses', async (req, res) => {
  try {
    const result = await surveyService.getResponseSummary(req.params.id)
    res.json(result)
  } catch (error) {
    console.error('Error fetching responses:', error)
    res.status(500).json({ error: 'Failed to fetch responses' })
  }
})

// =====================
// Houses Management
// =====================

// GET /api/surveys/houses - List houses (filtered by admin org)
router.get('/houses', authenticateAdmin, async (req, res) => {
  try {
    const houses = await authService.getHousesByOrganization(req.admin.organization)
    res.json(houses)
  } catch (error) {
    console.error('Error fetching houses:', error)
    res.status(500).json({ error: 'Failed to fetch houses' })
  }
})

// POST /api/surveys/houses - Create house
router.post('/houses', authenticateAdmin, async (req, res) => {
  try {
    const { houseId, password, name, organization, tariffHighStart, tariffLowStart } = req.body

    if (!houseId || !password) {
      return res.status(400).json({ error: 'House ID and password are required' })
    }

    const org = organization || req.admin.organization
    const house = await authService.createHouse(houseId, password, name, org, tariffHighStart, tariffLowStart)
    res.status(201).json(house)
  } catch (error) {
    console.error('Error creating house:', error)

    if (error.code === '23505') {
      return res.status(409).json({ error: 'House ID already exists' })
    }

    res.status(500).json({ error: 'Failed to create house' })
  }
})

// PUT /api/surveys/houses/:id - Update house
router.put('/houses/:id', authenticateAdmin, async (req, res) => {
  try {
    const house = await authService.updateHouse(req.params.id, req.body)

    if (!house) {
      return res.status(404).json({ error: 'House not found' })
    }

    res.json(house)
  } catch (error) {
    console.error('Error updating house:', error)
    res.status(500).json({ error: 'Failed to update house' })
  }
})

// DELETE /api/surveys/houses/:id - Delete house
router.delete('/houses/:id', authenticateAdmin, async (req, res) => {
  try {
    const deleted = await authService.deleteHouse(req.params.id)

    if (!deleted) {
      return res.status(404).json({ error: 'House not found' })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting house:', error)
    res.status(500).json({ error: 'Failed to delete house' })
  }
})

// =====================
// Send Survey
// =====================

// POST /api/surveys/send-survey - Send survey to selected houses
router.post('/send-survey', async (req, res) => {
  try {
    const { questionSetId, houseIds } = req.body

    if (!questionSetId || !houseIds || !Array.isArray(houseIds) || houseIds.length === 0) {
      return res.status(400).json({ error: 'Question set ID and at least one house ID are required' })
    }

    // Get question set for notification content
    const questionSet = await surveyService.getQuestionSetById(questionSetId)
    if (!questionSet) {
      return res.status(404).json({ error: 'Question set not found' })
    }

    // Create assignments
    const assignments = await surveyService.createBulkAssignments(questionSetId, houseIds)

    // Send notifications to houses with subscriptions
    const notificationResults = await pushService.sendToHouses(houseIds, {
      title: questionSet.notification_title,
      body: questionSet.notification_body,
      url: questionSet.notification_url || '/surveys',
      data: {
        type: 'survey',
        questionSetId
      }
    })

    // Mark notification as sent for successful sends
    for (const assignment of assignments) {
      if (notificationResults.sentHouses.includes(assignment.house_id)) {
        await surveyService.markNotificationSent(assignment.id)
      }
    }

    res.json({
      assignmentsCreated: assignments.length,
      notificationsSent: notificationResults.sent,
      notificationsFailed: notificationResults.failed
    })
  } catch (error) {
    console.error('Error sending survey:', error)
    res.status(500).json({ error: 'Failed to send survey' })
  }
})

// =====================
// Survey Triggers
// =====================

// GET /api/surveys/triggers/:questionSetId - Get trigger for a question set
router.get('/triggers/:questionSetId', authenticateAdmin, async (req, res) => {
  try {
    const trigger = await surveyTriggerService.getTriggerByQuestionSetId(req.params.questionSetId)
    res.json(trigger || null)
  } catch (error) {
    console.error('Error fetching survey trigger:', error)
    res.status(500).json({ error: 'Failed to fetch survey trigger' })
  }
})

// POST /api/surveys/triggers - Create or update trigger for a question set
router.post('/triggers', authenticateAdmin, async (req, res) => {
  try {
    const { questionSetId, conditions, sustainedMinutes, isActive } = req.body

    if (!questionSetId || !conditions) {
      return res.status(400).json({ error: 'Question set ID and conditions are required' })
    }

    // Check if trigger already exists for this question set
    const existing = await surveyTriggerService.getTriggerByQuestionSetId(questionSetId)

    let trigger
    if (existing) {
      trigger = await surveyTriggerService.updateTrigger(existing.id, {
        conditions,
        sustainedMinutes,
        isActive
      })
    } else {
      trigger = await surveyTriggerService.createTrigger({
        questionSetId,
        organization: req.admin.organization,
        conditions,
        sustainedMinutes,
        isActive,
        createdBy: req.admin.id
      })
    }

    res.status(existing ? 200 : 201).json(trigger)
  } catch (error) {
    if (error.message.includes('Invalid') || error.message.includes('required')) {
      return res.status(400).json({ error: error.message })
    }
    console.error('Error saving survey trigger:', error)
    res.status(500).json({ error: 'Failed to save survey trigger' })
  }
})

// DELETE /api/surveys/triggers/:questionSetId - Delete trigger for a question set
router.delete('/triggers/:questionSetId', authenticateAdmin, async (req, res) => {
  try {
    const trigger = await surveyTriggerService.getTriggerByQuestionSetId(req.params.questionSetId)
    if (!trigger) {
      return res.status(404).json({ error: 'Trigger not found' })
    }

    await surveyTriggerService.deleteTrigger(trigger.id)
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting survey trigger:', error)
    res.status(500).json({ error: 'Failed to delete survey trigger' })
  }
})

export default router
