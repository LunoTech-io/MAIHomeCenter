import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSurvey, submitSurveyResponses, dismissSurvey } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'
import RadioQuestion from './RadioQuestion'
import OpenTextQuestion from './OpenTextQuestion'
import NumberQuestion from './NumberQuestion'
import DisplayText from './DisplayText'

function SurveyView() {
  const { assignmentId } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()

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
      const initialResponses = {}
      data.questions?.forEach(q => {
        initialResponses[q.id] = null
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
      const responseArray = []
      survey?.questions?.forEach(q => {
        const raw = responses[q.id]
        if (raw === null || raw === '') return
        if (q.type === 'radio') {
          // raw is the selected option index; submit the option's value,
          // falling back to its label when no value was configured
          const option = q.options?.[raw]
          const value = option?.value || option?.label
          if (value) responseArray.push({ questionId: q.id, value })
        } else {
          responseArray.push({ questionId: q.id, value: raw })
        }
      })
      await submitSurveyResponses(assignmentId, responseArray)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismiss = async () => {
    if (!window.confirm(t('surveys.dismissConfirm'))) return
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
        <div className="loading">{t('common.loadingSurvey')}</div>
      </div>
    )
  }

  if (error && !survey) {
    return (
      <div className="survey-view-page">
        <div className="error-message">{error}</div>
        <button className="back-btn" onClick={() => navigate('/surveys')}>
          {t('surveys.backToSurveys')}
        </button>
      </div>
    )
  }

  if (success) {
    return (
      <div className="survey-view-page">
        <div className="success-state" role="status" aria-live="polite">
          <div className="success-icon" aria-hidden="true">✓</div>
          <h2>{t('surveys.thankYou')}</h2>
          <p>{t('surveys.submitted')}</p>
          <button className="primary-btn" onClick={() => navigate('/surveys')}>
            {t('surveys.backToSurveys')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="survey-view-page">
      <div className="survey-header">
        <button className="back-link" onClick={() => navigate('/surveys')}>
          ← {t('surveys.back')}
        </button>
        <h1>{survey?.title}</h1>
        {survey?.description && (
          <p className="survey-description">{survey.description}</p>
        )}
      </div>

      {error && (
        <div className="error-message" role="alert">{error}</div>
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
              ) : question.type === 'number' ? (
                <NumberQuestion
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
              {t('surveys.dismissSurvey')}
            </button>
          )}
          <button
            type="submit"
            className="submit-btn"
            disabled={submitting}
          >
            {submitting ? t('surveys.submitting') : t('surveys.submitResponses')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SurveyView
