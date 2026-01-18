import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getQuestionSet, createQuestionSet, updateQuestionSet } from '../../services/api'
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
      setError('Title, notification title, and notification body are required')
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
          <h1>{isNew ? 'New Survey' : 'Edit Survey'}</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>{isNew ? 'New Survey' : 'Edit Survey'}</h1>
        <p>{isNew ? 'Create a new question set' : 'Update survey details and questions'}</p>
      </div>

      {error && (
        <div className="result-message error" style={{ position: 'static', marginBottom: '16px' }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="admin-section">
          <h2>Survey Details</h2>

          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={form.title}
              onChange={handleFormChange}
              placeholder="Survey title"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleFormChange}
              placeholder="Brief description of this survey"
              rows={2}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="expiresAt">Expires At (optional)</label>
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
                Allow dismiss
              </label>
              <label>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleFormChange}
                />
                Active
              </label>
            </div>
          </div>
        </div>

        <div className="admin-section">
          <h2>Notification Settings</h2>

          <div className="form-group">
            <label htmlFor="notificationTitle">Notification Title</label>
            <input
              type="text"
              id="notificationTitle"
              name="notificationTitle"
              value={form.notificationTitle}
              onChange={handleFormChange}
              placeholder="Push notification title"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="notificationBody">Notification Body</label>
            <textarea
              id="notificationBody"
              name="notificationBody"
              value={form.notificationBody}
              onChange={handleFormChange}
              placeholder="Push notification message"
              rows={2}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="notificationUrl">Notification URL</label>
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
            <h2>Questions</h2>
            <button type="button" className="send-btn" onClick={addQuestion}>
              + Add Question
            </button>
          </div>

          {questions.length === 0 ? (
            <p className="no-subscribers">No questions yet. Add your first question.</p>
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
            Cancel
          </button>
          <button type="submit" className="send-btn" disabled={saving}>
            {saving ? 'Saving...' : (isNew ? 'Create Survey' : 'Save Changes')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SurveyEditor
