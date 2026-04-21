import { useState, useEffect } from 'react'
import { getSurveyTrigger, saveSurveyTrigger, deleteSurveyTrigger } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'
import { ROOM_TYPES } from '../../utils/roomTypes'

const emptyCondition = { sensorField: 'temperature', operator: 'above', threshold: '' }

function SurveyTriggerModal({ survey, onClose }) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [hasExisting, setHasExisting] = useState(false)

  const [conditions, setConditions] = useState([{ ...emptyCondition }])
  const [roomTypes, setRoomTypes] = useState([])
  const [sustainedMinutes, setSustainedMinutes] = useState(0)
  const [isActive, setIsActive] = useState(true)

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

  useEffect(() => {
    loadTrigger()
  }, [])

  const loadTrigger = async () => {
    try {
      setLoading(true)
      const trigger = await getSurveyTrigger(survey.id)
      if (trigger) {
        setHasExisting(true)
        setConditions(
          (trigger.conditions || []).map(c => ({
            sensorField: c.sensorField || 'temperature',
            operator: c.operator || 'above',
            threshold: c.threshold ?? ''
          }))
        )
        setRoomTypes(Array.isArray(trigger.room_types) ? trigger.room_types : [])
        setSustainedMinutes(trigger.sustained_minutes ?? 0)
        setIsActive(trigger.is_active ?? true)
      }
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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

  const handleSave = async () => {
    if (conditions.length === 0 || conditions.some(c => c.threshold === '')) {
      setError(t('triggers.validationRequired'))
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await saveSurveyTrigger({
        questionSetId: survey.id,
        conditions: conditions.map(c => ({
          sensorField: c.sensorField,
          operator: c.operator,
          threshold: parseFloat(c.threshold)
        })),
        roomTypes,
        sustainedMinutes: parseInt(sustainedMinutes, 10) || 0,
        isActive
      })
      setHasExisting(true)
      setSuccess(t('triggers.saved'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(t('triggers.removeConfirm'))) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await deleteSurveyTrigger(survey.id)
      setHasExisting(false)
      setConditions([{ ...emptyCondition }])
      setRoomTypes([])
      setSustainedMinutes(0)
      setIsActive(true)
      setSuccess(t('triggers.removed'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>{t('triggers.title')}</h2>
          <button className="modal-close" onClick={onClose}>X</button>
        </div>

        <div className="modal-body">
          <p className="survey-title-display">
            <strong>{survey.title}</strong>
          </p>
          <p style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '16px' }}>
            {t('triggers.description')}
          </p>

          {loading ? (
            <div className="loading">{t('common.loading')}</div>
          ) : (
            <>
              {error && <div className="result-message error" style={{ position: 'static', marginBottom: '12px' }}>{error}</div>}
              {success && <div className="result-message success" style={{ position: 'static', marginBottom: '12px' }}>{success}</div>}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  {t('triggers.roomTypes')}
                </label>
                <small style={{ color: '#888', display: 'block', marginBottom: '8px' }}>
                  {t('triggers.roomTypesHelp')}
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

              <div style={{ marginBottom: '16px' }}>
                <div className="section-header" style={{ marginBottom: '8px' }}>
                  <label style={{ fontWeight: 600 }}>{t('triggers.conditions')}</label>
                  <button type="button" className="send-btn" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={addCondition}>
                    {t('triggers.add')}
                  </button>
                </div>
                <small style={{ color: '#888', display: 'block', marginBottom: '8px' }}>
                  {t('triggers.andLogic')}
                </small>

                {conditions.map((condition, index) => (
                  <div key={index} className="form-row" style={{ alignItems: 'flex-end', marginBottom: '8px' }}>
                    <div className="form-group">
                      {index === 0 && <label>{t('triggers.sensor')}</label>}
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
                      {index === 0 && <label>{t('triggers.operator')}</label>}
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
                      {index === 0 && <label>{t('triggers.threshold')}</label>}
                      <input
                        type="number"
                        value={condition.threshold}
                        onChange={(e) => updateCondition(index, 'threshold', e.target.value)}
                        placeholder={t('triggers.thresholdPlaceholder')}
                        step="any"
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
                        {t('triggers.remove')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-row" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label>{t('triggers.sustainedDuration')}</label>
                  <input
                    type="number"
                    value={sustainedMinutes}
                    onChange={(e) => setSustainedMinutes(e.target.value)}
                    min="0"
                    placeholder={t('triggers.instantPlaceholder')}
                  />
                  <small style={{ color: '#888', marginTop: '4px', display: 'block' }}>
                    {t('triggers.sustainedHelp')}
                  </small>
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    {t('triggers.active')}
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                {hasExisting && (
                  <button
                    type="button"
                    className="action-btn-small delete"
                    onClick={handleDelete}
                    disabled={saving}
                    style={{ padding: '8px 16px', fontSize: '14px' }}
                  >
                    {t('triggers.removeTrigger')}
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button type="button" className="cancel-btn" onClick={onClose}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="send-btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? t('triggers.saving') : (hasExisting ? t('triggers.updateTrigger') : t('triggers.createTrigger'))}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SurveyTriggerModal
