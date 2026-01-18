import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSurvey, submitSurveyResponses, dismissSurvey } from '../../services/api'
import RadioQuestion from './RadioQuestion'
import OpenTextQuestion from './OpenTextQuestion'
import DisplayText from './DisplayText'

function SurveyView() {
  const { assignmentId } = useParams()
  const navigate = useNavigate()

  const [survey, setSurvey] = useState(null)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadSurvey()
  }, [assignmentId])

  const loadSurvey = async () => {
    try {
      setLoading(true)
      const data = await getSurvey(assignmentId)
      setSurvey(data)

      // Initialize responses
      const initialResponses = {}
      data.questions?.forEach(q => {
        initialResponses[q.id] = ''
      })
      setResponses(initialResponses)

      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResponseChange = (questionId, value) => {
    setResponses(prev => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const responseArray = Object.entries(responses)
        .filter(([_, value]) => value !== '')
        .map(([questionId, value]) => ({
          questionId,
          value
        }))

      await submitSurveyResponses(assignmentId, responseArray)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismiss = async () => {
    if (!window.confirm('Are you sure you want to dismiss this survey?')) return

    setSubmitting(true)
    setError(null)

    try {
      await dismissSurvey(assignmentId)
      navigate('/surveys')
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="survey-view-page">
        <div className="loading">Loading survey...</div>
      </div>
    )
  }

  if (error && !survey) {
    return (
      <div className="survey-view-page">
        <div className="error-message">{error}</div>
        <button className="back-btn" onClick={() => navigate('/surveys')}>
          Back to Surveys
        </button>
      </div>
    )
  }

  if (success) {
    return (
      <div className="survey-view-page">
        <div className="success-state">
          <div className="success-icon">✓</div>
          <h2>Thank You!</h2>
          <p>Your responses have been submitted successfully.</p>
          <button className="primary-btn" onClick={() => navigate('/surveys')}>
            Back to Surveys
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="survey-view-page">
      <div className="survey-header">
        <button className="back-link" onClick={() => navigate('/surveys')}>
          ← Back
        </button>
        <h1>{survey?.title}</h1>
        {survey?.description && (
          <p className="survey-description">{survey.description}</p>
        )}
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="survey-form">
        <div className="questions">
          {survey?.questions?.map((question, index) => (
            <div key={question.id} className="question-wrapper">
              {question.type === 'display' ? (
                <DisplayText question={question} />
              ) : question.type === 'radio' ? (
                <RadioQuestion
                  question={question}
                  value={responses[question.id]}
                  onChange={(value) => handleResponseChange(question.id, value)}
                  index={index}
                />
              ) : question.type === 'open_text' ? (
                <OpenTextQuestion
                  question={question}
                  value={responses[question.id]}
                  onChange={(value) => handleResponseChange(question.id, value)}
                  index={index}
                />
              ) : null}
            </div>
          ))}
        </div>

        <div className="survey-actions">
          {survey?.is_dismissable && (
            <button
              type="button"
              className="dismiss-btn"
              onClick={handleDismiss}
              disabled={submitting}
            >
              Dismiss Survey
            </button>
          )}
          <button
            type="submit"
            className="submit-btn"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Responses'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SurveyView
