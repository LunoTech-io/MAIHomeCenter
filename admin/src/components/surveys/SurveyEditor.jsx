import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getQuestionSet, createQuestionSet, updateQuestionSet } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'
import QuestionEditor from './QuestionEditor'

const emptyQuestion = {
  identifier: '',
  type: 'radio',
  questionText: '',
  options: [{ value: '', label: '' }],
  isRequired: true
}

function SurveyEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const isNew = !id

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    notificationTitle: '',
    notificationBody: '',
    notificationUrl: '/surveys',
    expiresAt: '',
    isDismissable: true,
    isActive: true
  })

  const [questions, setQuestions] = useState([])

  useEffect(() => {
    if (!isNew) {
      loadQuestionSet()
    }
  }, [id])

  const loadQuestionSet = async () => {
    try {
      setLoading(true)
      const data = await getQuestionSet(id)
      setForm({
        title: data.title || '',
        description: data.description || '',
        notificationTitle: data.notification_title || '',
        notificationBody: data.notification_body || '',
        notificationUrl: data.notification_url || '/surveys',
        expiresAt: data.expires_at ? data.expires_at.split('T')[0] : '',
        isDismissable: data.is_dismissable ?? true,
        isActive: data.is_active ?? true
      })
      setQuestions(data.questions?.map(q => ({
        id: q.id,
        identifier: q.identifier,
        type: q.type,
        questionText: q.question_text,
        options: q.options || [],
        isRequired: q.is_required
      })) || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const addQuestion = () => {
    setQuestions(prev => [...prev, { ...emptyQuestion, identifier: `q${prev.length + 1}` }])
  }

  const updateQuestion = (index, data) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...data } : q))
  }

  const removeQuestion = (index) => {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  const moveQuestion = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= questions.length) return

    setQuestions(prev => {
      const newQuestions = [...prev]
      const temp = newQuestions[index]
      newQuestions[index] = newQuestions[newIndex]
      newQuestions[newIndex] = temp
      return newQuestions
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.title || !form.notificationTitle || !form.notificationBody) {
      setError(t('surveys.validationRequired'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        ...form,
        questions: questions.map((q, i) => ({
          ...q,
          orderIndex: i
        }))
      }

      if (isNew) {
        await createQuestionSet(payload)
      } else {
        await updateQuestionSet(id, payload)
      }

      navigate('/surveys')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="admin">
        <div className="admin-header">
          <h1>{isNew ? t('surveys.newSurveyTitle') : t('surveys.editSurveyTitle')}</h1>
        </div>
        <div className="loading">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>{isNew ? t('surveys.newSurveyTitle') : t('surveys.editSurveyTitle')}</h1>
        <p>{isNew ? t('surveys.newSurveySubtitle') : t('surveys.editSurveySubtitle')}</p>
      </div>

      {error && (
        <div className="survey-error">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="admin-section">
          <h2>{t('surveys.surveyDetails')}</h2>

          <div className="form-group">
            <label htmlFor="title">{t('surveys.titleField')}</label>
            <input
              type="text"
              id="title"
              name="title"
              value={form.title}
              onChange={handleFormChange}
              placeholder={t('surveys.titlePlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">{t('surveys.description')}</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleFormChange}
              placeholder={t('surveys.descriptionPlaceholder')}
              rows={2}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="expiresAt">{t('surveys.expiresAt')}</label>
              <input
                type="date"
                id="expiresAt"
                name="expiresAt"
                value={form.expiresAt}
                onChange={handleFormChange}
              />
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="isDismissable"
                  checked={form.isDismissable}
                  onChange={handleFormChange}
                />
                {t('surveys.allowDismiss')}
              </label>
              <label>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleFormChange}
                />
                {t('surveys.active')}
              </label>
            </div>
          </div>
        </div>

        <div className="admin-section">
          <h2>{t('surveys.notificationSettings')}</h2>

          <div className="form-group">
            <label htmlFor="notificationTitle">{t('surveys.notificationTitle')}</label>
            <input
              type="text"
              id="notificationTitle"
              name="notificationTitle"
              value={form.notificationTitle}
              onChange={handleFormChange}
              placeholder={t('surveys.notificationTitlePlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="notificationBody">{t('surveys.notificationBody')}</label>
            <textarea
              id="notificationBody"
              name="notificationBody"
              value={form.notificationBody}
              onChange={handleFormChange}
              placeholder={t('surveys.notificationBodyPlaceholder')}
              rows={2}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="notificationUrl">{t('surveys.notificationUrl')}</label>
            <input
              type="text"
              id="notificationUrl"
              name="notificationUrl"
              value={form.notificationUrl}
              onChange={handleFormChange}
              placeholder="/surveys"
            />
          </div>
        </div>

        <div className="admin-section">
          <div className="section-header">
            <h2>{t('surveys.questionsSection')}</h2>
            <button type="button" className="add-question-btn" onClick={addQuestion}>
              + {t('surveys.addQuestion')}
            </button>
          </div>

          {questions.length === 0 ? (
            <p className="empty-questions">{t('surveys.noQuestions')}</p>
          ) : (
            <div className="questions-list">
              {questions.map((question, index) => (
                <QuestionEditor
                  key={index}
                  question={question}
                  index={index}
                  totalQuestions={questions.length}
                  onChange={(data) => updateQuestion(index, data)}
                  onRemove={() => removeQuestion(index)}
                  onMoveUp={() => moveQuestion(index, -1)}
                  onMoveDown={() => moveQuestion(index, 1)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={() => navigate('/surveys')}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="send-btn" disabled={saving}>
            {saving ? t('surveys.saving') : (isNew ? t('surveys.createSurvey') : t('surveys.saveChanges'))}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SurveyEditor
