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

function AlertRuleEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    name: '',
    sensorField: 'temperature',
    operator: 'above',
    threshold: '',
    sustainedMinutes: 0,
    notificationTitle: '',
    notificationBody: '',
    isActive: true
  })

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
        sensorField: data.sensor_field || 'temperature',
        operator: data.operator || 'above',
        threshold: data.threshold ?? '',
        sustainedMinutes: data.sustained_minutes ?? 0,
        notificationTitle: data.notification_title || '',
        notificationBody: data.notification_body || '',
        isActive: data.is_active ?? true
      })
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.name || !form.notificationTitle || !form.notificationBody || form.threshold === '') {
      setError('Name, threshold, notification title, and notification body are required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        ...form,
        threshold: parseFloat(form.threshold),
        sustainedMinutes: parseInt(form.sustainedMinutes, 10) || 0
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
              onChange={handleChange}
              placeholder="e.g., High temperature warning"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sensorField">Sensor Field</label>
              <select
                id="sensorField"
                name="sensorField"
                value={form.sensorField}
                onChange={handleChange}
              >
                {SENSOR_FIELDS.map(sf => (
                  <option key={sf.value} value={sf.value}>{sf.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="operator">Operator</label>
              <select
                id="operator"
                name="operator"
                value={form.operator}
                onChange={handleChange}
              >
                {OPERATORS.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="threshold">Threshold</label>
              <input
                type="number"
                id="threshold"
                name="threshold"
                value={form.threshold}
                onChange={handleChange}
                placeholder="e.g., 28"
                step="any"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sustainedMinutes">Sustained Duration (minutes)</label>
              <input
                type="number"
                id="sustainedMinutes"
                name="sustainedMinutes"
                value={form.sustainedMinutes}
                onChange={handleChange}
                min="0"
                placeholder="0 = instant"
              />
              <small style={{ color: '#888', marginTop: '4px', display: 'block' }}>
                0 = trigger immediately, e.g. 120 = must hold for 2 hours
              </small>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                />
                Active
              </label>
            </div>
          </div>
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
              onChange={handleChange}
              placeholder="e.g., High temperature in {room}"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="notificationBody">Notification Body</label>
            <textarea
              id="notificationBody"
              name="notificationBody"
              value={form.notificationBody}
              onChange={handleChange}
              placeholder="e.g., Temperature in {room} is {value}°C"
              rows={3}
              required
            />
            <small style={{ color: '#888', marginTop: '4px', display: 'block' }}>
              Use {'{room}'} for room name and {'{value}'} for the sensor reading
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
