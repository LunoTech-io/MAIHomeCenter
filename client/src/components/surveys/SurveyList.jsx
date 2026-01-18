import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getPendingSurveys } from '../../services/api'

function SurveyList() {
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadSurveys()
  }, [])

  const loadSurveys = async () => {
    try {
      setLoading(true)
      const data = await getPendingSurveys()
      setSurveys(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="survey-list-page">
        <div className="page-header">
          <h1>Your Surveys</h1>
        </div>
        <div className="loading">Loading surveys...</div>
      </div>
    )
  }

  return (
    <div className="survey-list-page">
      <div className="page-header">
        <h1>Your Surveys</h1>
        <p>Complete pending surveys to share your feedback</p>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {surveys.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✓</div>
          <h2>All caught up!</h2>
          <p>You have no pending surveys at this time.</p>
        </div>
      ) : (
        <div className="survey-cards">
          {surveys.map(survey => (
            <Link
              key={survey.assignment_id}
              to={`/surveys/${survey.assignment_id}`}
              className="survey-card-link"
            >
              <div className="survey-card">
                <h3>{survey.title}</h3>
                {survey.description && (
                  <p className="survey-description">{survey.description}</p>
                )}
                <div className="survey-card-meta">
                  {survey.expires_at && (
                    <span className="expiry">
                      Expires: {new Date(survey.expires_at).toLocaleDateString()}
                    </span>
                  )}
                  {survey.is_dismissable && (
                    <span className="dismissable">Optional</span>
                  )}
                </div>
                <div className="survey-card-action">
                  Start Survey
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default SurveyList
