import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getQuestionSets, deleteQuestionSet } from '../../services/api'
import SendSurveyModal from './SendSurveyModal'

function SurveyList() {
  const [questionSets, setQuestionSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [selectedSurvey, setSelectedSurvey] = useState(null)

  useEffect(() => {
    loadQuestionSets()
  }, [])

  const loadQuestionSets = async () => {
    try {
      setLoading(true)
      const data = await getQuestionSets()
      setQuestionSets(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this survey?')) return

    try {
      await deleteQuestionSet(id)
      setQuestionSets(prev => prev.filter(qs => qs.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSendClick = (survey) => {
    setSelectedSurvey(survey)
    setSendModalOpen(true)
  }

  if (loading) {
    return (
      <div className="admin">
        <div className="admin-header">
          <h1>Surveys</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>Surveys</h1>
        <p>Create and manage survey question sets</p>
      </div>

      {error && (
        <div className="result-message error">{error}</div>
      )}

      <div className="admin-section">
        <div className="section-header">
          <h2>Question Sets</h2>
          <Link to="/surveys/new" className="send-btn">+ New Survey</Link>
        </div>

        {questionSets.length === 0 ? (
          <p className="no-subscribers">No surveys yet. Create your first survey to get started.</p>
        ) : (
          <div className="survey-list">
            {questionSets.map(qs => (
              <div key={qs.id} className="survey-card">
                <div className="survey-info">
                  <h3>{qs.title}</h3>
                  {qs.description && <p className="survey-description">{qs.description}</p>}
                  <div className="survey-meta">
                    <span>{qs.question_count || 0} questions</span>
                    <span>{qs.assignment_count || 0} assignments</span>
                    <span className={qs.is_active ? 'status-active' : 'status-inactive'}>
                      {qs.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="survey-actions">
                  <button
                    className="action-btn-small send"
                    onClick={() => handleSendClick(qs)}
                  >
                    Send
                  </button>
                  <Link to={`/surveys/${qs.id}/responses`} className="action-btn-small view">
                    Responses
                  </Link>
                  <Link to={`/surveys/${qs.id}`} className="action-btn-small edit">
                    Edit
                  </Link>
                  <button
                    className="action-btn-small delete"
                    onClick={() => handleDelete(qs.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {sendModalOpen && (
        <SendSurveyModal
          survey={selectedSurvey}
          onClose={() => setSendModalOpen(false)}
        />
      )}
    </div>
  )
}

export default SurveyList
