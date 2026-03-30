import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getQuestionSets, deleteQuestionSet } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'
import SendSurveyModal from './SendSurveyModal'
import SurveyTriggerModal from './SurveyTriggerModal'

function SurveyList() {
  const { t } = useLanguage()
  const [questionSets, setQuestionSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [triggerModalOpen, setTriggerModalOpen] = useState(false)
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
    if (!window.confirm(t('surveys.deleteConfirm'))) return

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

  const handleTriggerClick = (survey) => {
    setSelectedSurvey(survey)
    setTriggerModalOpen(true)
  }

  if (loading) {
    return (
      <div className="admin">
        <div className="admin-header">
          <h1>{t('surveys.title')}</h1>
        </div>
        <div className="loading">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>{t('surveys.title')}</h1>
        <p>{t('surveys.subtitle')}</p>
      </div>

      {error && (
        <div className="result-message error">{error}</div>
      )}

      <div className="admin-section">
        <div className="section-header">
          <h2>{t('surveys.questionSets')}</h2>
          <Link to="/surveys/new" className="send-btn">{t('surveys.newSurvey')}</Link>
        </div>

        {questionSets.length === 0 ? (
          <p className="no-subscribers">{t('surveys.noSurveys')}</p>
        ) : (
          <div className="survey-list">
            {questionSets.map(qs => (
              <div key={qs.id} className="survey-card">
                <div className="survey-info">
                  <h3>{qs.title}</h3>
                  {qs.description && <p className="survey-description">{qs.description}</p>}
                  <div className="survey-meta">
                    <span>{qs.question_count || 0} {t('surveys.questions')}</span>
                    <span>{qs.assignment_count || 0} {t('surveys.assignments')}</span>
                    <span className={qs.is_active ? 'status-active' : 'status-inactive'}>
                      {qs.is_active ? t('surveys.active') : t('surveys.inactive')}
                    </span>
                  </div>
                </div>
                <div className="survey-actions">
                  <button
                    className="action-btn-small send"
                    onClick={() => handleSendClick(qs)}
                  >
                    {t('surveys.send')}
                  </button>
                  <button
                    className="action-btn-small trigger"
                    onClick={() => handleTriggerClick(qs)}
                  >
                    {t('surveys.trigger')}
                  </button>
                  <Link to={`/surveys/${qs.id}/responses`} className="action-btn-small view">
                    {t('surveys.responses')}
                  </Link>
                  <Link to={`/surveys/${qs.id}`} className="action-btn-small edit">
                    {t('surveys.edit')}
                  </Link>
                  <button
                    className="action-btn-small delete"
                    onClick={() => handleDelete(qs.id)}
                  >
                    {t('surveys.delete')}
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

      {triggerModalOpen && (
        <SurveyTriggerModal
          survey={selectedSurvey}
          onClose={() => setTriggerModalOpen(false)}
        />
      )}
    </div>
  )
}

export default SurveyList
