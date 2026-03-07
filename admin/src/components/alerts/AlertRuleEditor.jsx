import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAlertRule, createAlertRule, updateAlertRule } from '../../services/api'

const SENSOR_FIELDS = [
  { value: 'temperature', label: 'Temperature' },
  { value: 'humidity', label: 'Humidity' },
  { value: 'co2', label: 'CO2' },
  { value: 'tvoc', label: 'TVOC' },
  { value: 'pressure', label: 'Pressure' },
  { value: 'light_level', label: 'Light Level' }
]

const OPERATORS = [
  { value: 'above', label: 'Above' },
  { value: 'below', label: 'Below' }
]

const emptyCondition = { sensorField: 'temperature', operator: 'above', threshold: '' }

function AlertRuleEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    name: '',
    sustainedMinutes: 0,
    notificationTitle: '',
    notificationBody: '',
    isActive: true
  })

  const [conditions, setConditions] = useState([{ ...emptyCondition }])

  useEffect(() => {
    if (!isNew) {
      loadRule()
    }
  }, [id])

  const loadRule = async () => {
    try {
      setLoading(true)
      const data = await getAlertRule(id)
      setForm({
        name: data.name || '',
        sustainedMinutes: data.sustained_minutes ?? 0,
        notificationTitle: data.notification_title || '',
        notificationBody: data.notification_body || '',
        isActive: data.is_active ?? true
      })
      setConditions(
        (data.conditions || []).map(c => ({
          sensorField: c.sensorField || 'temperature',
          operator: c.operator || 'above',
          threshold: c.threshold ?? ''
        }))
      )
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

  const updateCondition = (index, field, value) => {
    setConditions(prev => prev.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    ))
  }

  const addCondition = () => {
    setConditions(prev => [...prev, { ...emptyCondition }])
  }

  const removeCondition = (index) => {
    setConditions(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.name || !form.notificationTitle || !form.notificationBody) {
      setError('Name, notification title, and notification body are required')
      return
    }

    if (conditions.length === 0 || conditions.some(c => c.threshold === '')) {
      setError('At least one condition with a threshold is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        ...form,
        sustainedMinutes: parseInt(form.sustainedMinutes, 10) || 0,
        conditions: conditions.map(c => ({
          sensorField: c.sensorField,
          operator: c.operator,
          threshold: parseFloat(c.threshold)
        }))
      }

      if (isNew) {
        await createAlertRule(payload)
      } else {
        await updateAlertRule(id, payload)
      }

      navigate('/alerts')
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
          <h1>{isNew ? 'New Alert Rule' : 'Edit Alert Rule'}</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>{isNew ? 'New Alert Rule' : 'Edit Alert Rule'}</h1>
        <p>{isNew ? 'Create a new automatic alert rule' : 'Update alert rule settings'}</p>
      </div>

      {error && (
        <div className="result-message error" style={{ position: 'static', marginBottom: '16px' }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="admin-section">
          <h2>Rule Settings</h2>

          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={form.name}
              onChange={handleFormChange}
              placeholder="e.g., High temperature + low humidity"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sustainedMinutes">Sustained Duration (minutes)</label>
              <input
                type="number"
                id="sustainedMinutes"
                name="sustainedMinutes"
                value={form.sustainedMinutes}
                onChange={handleFormChange}
                min="0"
                placeholder="0 = instant"
              />
              <small style={{ color: '#888', marginTop: '4px', display: 'block' }}>
                0 = trigger immediately. Sensors report every ~15 min, so use at least 30 min for sustained rules.
              </small>
            </div>

            <div className="form-group checkbox-group">
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
          <div className="section-header">
            <h2>Conditions</h2>
            <button type="button" className="send-btn" onClick={addCondition}>
              + Add Condition
            </button>
          </div>
          <small style={{ color: '#888', display: 'block', marginBottom: '12px' }}>
            All conditions must be true simultaneously (AND logic)
          </small>

          {conditions.map((condition, index) => (
            <div key={index} className="form-row" style={{ alignItems: 'flex-end', marginBottom: '8px' }}>
              <div className="form-group">
                {index === 0 && <label>Sensor Field</label>}
                <select
                  value={condition.sensorField}
                  onChange={(e) => updateCondition(index, 'sensorField', e.target.value)}
                >
                  {SENSOR_FIELDS.map(sf => (
                    <option key={sf.value} value={sf.value}>{sf.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                {index === 0 && <label>Operator</label>}
                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                >
                  {OPERATORS.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                {index === 0 && <label>Threshold</label>}
                <input
                  type="number"
                  value={condition.threshold}
                  onChange={(e) => updateCondition(index, 'threshold', e.target.value)}
                  placeholder="e.g., 28"
                  step="any"
                  required
                />
              </div>

              <div className="form-group" style={{ flex: '0 0 auto' }}>
                {index === 0 && <label>&nbsp;</label>}
                <button
                  type="button"
                  className="action-btn-small delete"
                  onClick={() => removeCondition(index)}
                  disabled={conditions.length === 1}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-section">
          <h2>Notification</h2>

          <div className="form-group">
            <label htmlFor="notificationTitle">Notification Title</label>
            <input
              type="text"
              id="notificationTitle"
              name="notificationTitle"
              value={form.notificationTitle}
              onChange={handleFormChange}
              placeholder="e.g., Alert in {room}"
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
              placeholder="e.g., Conditions exceeded in {room} (current: {value})"
              rows={3}
              required
            />
            <small style={{ color: '#888', marginTop: '4px', display: 'block' }}>
              Use {'{room}'} for room name and {'{value}'} for the first condition's reading
            </small>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={() => navigate('/alerts')}>
            Cancel
          </button>
          <button type="submit" className="send-btn" disabled={saving}>
            {saving ? 'Saving...' : (isNew ? 'Create Rule' : 'Save Changes')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AlertRuleEditor
