import { Router } from 'express'
import { authenticateToken } from '../middleware/authMiddleware.js'
import surveyService from '../services/surveyService.js'

const router = Router()

// All routes require authentication
router.use(authenticateToken)

// GET /api/my-surveys/pending - Get pending surveys for current house
router.get('/pending', async (req, res) => {
  try {
    const surveys = await surveyService.getPendingSurveys(req.house.id)
    res.json(surveys)
  } catch (error) {
    console.error('Error fetching pending surveys:', error)
    res.status(500).json({ error: 'Failed to fetch pending surveys' })
  }
})

// GET /api/my-surveys/:assignmentId - Get survey with questions
router.get('/:assignmentId', async (req, res) => {
  try {
    const survey = await surveyService.getSurveyForResponse(req.params.assignmentId, req.house.id)

    if (!survey) {
      return res.status(404).json({ error: 'Survey not found or not assigned to you' })
    }

    res.json(survey)
  } catch (error) {
    console.error('Error fetching survey:', error)
    res.status(500).json({ error: 'Failed to fetch survey' })
  }
})

// POST /api/my-surveys/:assignmentId/respond - Submit responses
router.post('/:assignmentId/respond', async (req, res) => {
  try {
    const { responses } = req.body

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'Responses array is required' })
    }

    // Verify assignment belongs to this house
    const survey = await surveyService.getSurveyForResponse(req.params.assignmentId, req.house.id)

    if (!survey) {
      return res.status(404).json({ error: 'Survey not found or not assigned to you' })
    }

    if (survey.status !== 'pending') {
      return res.status(400).json({ error: 'Survey already completed or dismissed' })
    }

    // Validate required questions
    const requiredQuestions = survey.questions.filter(q => q.is_required && q.type !== 'display')
    const responseMap = new Map(responses.map(r => [r.questionId, r.value]))

    for (const rq of requiredQuestions) {
      const value = responseMap.get(rq.id)
      if (value === undefined || value === null || value === '') {
        return res.status(400).json({ error: `Question "${rq.question_text}" is required` })
      }
    }

    await surveyService.submitResponses(req.params.assignmentId, responses)

    res.json({ success: true, message: 'Survey responses submitted successfully' })
  } catch (error) {
    console.error('Error submitting responses:', error)
    res.status(500).json({ error: 'Failed to submit responses' })
  }
})

// POST /api/my-surveys/:assignmentId/dismiss - Dismiss survey
router.post('/:assignmentId/dismiss', async (req, res) => {
  try {
    // Verify survey is dismissable
    const survey = await surveyService.getSurveyForResponse(req.params.assignmentId, req.house.id)

    if (!survey) {
      return res.status(404).json({ error: 'Survey not found or not assigned to you' })
    }

    if (!survey.is_dismissable) {
      return res.status(400).json({ error: 'This survey cannot be dismissed' })
    }

    if (survey.status !== 'pending') {
      return res.status(400).json({ error: 'Survey already completed or dismissed' })
    }

    const result = await surveyService.dismissSurvey(req.params.assignmentId, req.house.id)

    if (!result) {
      return res.status(400).json({ error: 'Failed to dismiss survey' })
    }

    res.json({ success: true, message: 'Survey dismissed' })
  } catch (error) {
    console.error('Error dismissing survey:', error)
    res.status(500).json({ error: 'Failed to dismiss survey' })
  }
})

export default router
