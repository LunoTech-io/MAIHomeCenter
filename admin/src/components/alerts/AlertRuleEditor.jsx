import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAlertRule, createAlertRule, updateAlertRule } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'
import { ROOM_TYPES } from '../../utils/roomTypes'

const emptyCondition = { sensorField: 'temperature', operator: 'above', threshold: '' }

function AlertRuleEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const isNew = !id

  const SENSOR_FIELDS = [
    { value: 'temperature', label: t('sensor.temperature') },
    { value: 'humidity', label: t('sensor.humidity') },
    { value: 'co2', label: t('sensor.co2') },
    { value: 'tvoc', label: t('sensor.tvoc') },
    { value: 'pressure', label: t('sensor.pressure') },
    { value: 'light_level', label: t('sensor.light_level') }
  ]

  const OPERATORS = [
    { value: 'above', label: t('sensor.above') },
    { value: 'below', label: t('sensor.below') }
  ]

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
  const [roomTypes, setRoomTypes] = useState([])

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
      setRoomTypes(Array.isArray(data.room_types) ? data.room_types : [])
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

  const toggleRoomType = (rt) => {
    setRoomTypes(prev => prev.includes(rt) ? prev.filter(x => x !== rt) : [...prev, rt])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.name || !form.notificationTitle || !form.notificationBody) {
      setError(t('alertRules.validationRequired'))
      return
    }

    if (conditions.length === 0 || conditions.some(c => c.threshold === '')) {
      setError(t('alertRules.conditionRequired'))
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
        })),
        roomTypes
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
          <h1>{isNew ? t('alertRules.newRuleTitle') : t('alertRules.editRuleTitle')}</h1>
        </div>
        <div className="loading">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>{isNew ? t('alertRules.newRuleTitle') : t('alertRules.editRuleTitle')}</h1>
        <p>{isNew ? t('alertRules.newRuleSubtitle') : t('alertRules.editRuleSubtitle')}</p>
      </div>

      {error && (
        <div className="result-message error" style={{ position: 'static', marginBottom: '16px' }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="admin-section">
          <h2>{t('alertRules.ruleSettings')}</h2>

          <div className="form-group">
            <label htmlFor="name">{t('alertRules.name')}</label>
            <input
              type="text"
              id="name"
              name="name"
              value={form.name}
              onChange={handleFormChange}
              placeholder={t('alertRules.namePlaceholder')}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sustainedMinutes">{t('alertRules.sustainedDuration')}</label>
              <input
                type="number"
                id="sustainedMinutes"
                name="sustainedMinutes"
                value={form.sustainedMinutes}
                onChange={handleFormChange}
                min="0"
                placeholder={t('alertRules.instantPlaceholder')}
              />
              <small style={{ color: '#888', marginTop: '4px', display: 'block' }}>
                {t('alertRules.sustainedHelp')}
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
                {t('alertRules.active')}
              </label>
            </div>
          </div>
        </div>

        <div className="admin-section">
          <div className="section-header">
            <h2>{t('alertRules.conditions')}</h2>
            <button type="button" className="send-btn" onClick={addCondition}>
              {t('alertRules.addCondition')}
            </button>
          </div>
          <small style={{ color: '#888', display: 'block', marginBottom: '12px' }}>
            {t('alertRules.andLogic')}
          </small>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              {t('alertRules.roomTypes')}
            </label>
            <small style={{ color: '#888', display: 'block', marginBottom: '8px' }}>
              {t('alertRules.roomTypesHelp')}
            </small>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {ROOM_TYPES.map(rt => (
                <label key={rt} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={roomTypes.includes(rt)}
                    onChange={() => toggleRoomType(rt)}
                  />
                  {t(`roomType.${rt}`)}
                </label>
              ))}
            </div>
          </div>

          {conditions.map((condition, index) => (
            <div key={index} className="form-row" style={{ alignItems: 'flex-end', marginBottom: '8px' }}>
              <div className="form-group">
                {index === 0 && <label>{t('alertRules.sensorField')}</label>}
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
                {index === 0 && <label>{t('alertRules.operator')}</label>}
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
                {index === 0 && <label>{t('alertRules.threshold')}</label>}
                <input
                  type="number"
                  value={condition.threshold}
                  onChange={(e) => updateCondition(index, 'threshold', e.target.value)}
                  placeholder={t('alertRules.thresholdPlaceholder')}
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
                  {t('alertRules.remove')}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-section">
          <h2>{t('alertRules.notification')}</h2>

          <div className="form-group">
            <label htmlFor="notificationTitle">{t('alertRules.notificationTitle')}</label>
            <input
              type="text"
              id="notificationTitle"
              name="notificationTitle"
              value={form.notificationTitle}
              onChange={handleFormChange}
              placeholder={t('alertRules.notificationTitlePlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="notificationBody">{t('alertRules.notificationBody')}</label>
            <textarea
              id="notificationBody"
              name="notificationBody"
              value={form.notificationBody}
              onChange={handleFormChange}
              placeholder={t('alertRules.notificationBodyPlaceholder')}
              rows={3}
              required
            />
            <small style={{ color: '#888', marginTop: '4px', display: 'block' }}>
              {t('alertRules.templateHelp')}
            </small>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={() => navigate('/alerts')}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="send-btn" disabled={saving}>
            {saving ? t('alertRules.saving') : (isNew ? t('alertRules.createRule') : t('alertRules.saveChanges'))}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AlertRuleEditor
