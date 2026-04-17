import { useState, useEffect } from 'react'
import { getComfortThresholds, updateComfortThresholds } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'
import { ROOM_TYPES, normalizeThresholds } from '../../utils/roomTypes'

const DEFAULTS = {
  temperature: { tooCold: 17, cool: 19, warm: 23, tooHot: 26 },
  humidity: { veryDry: 30, dry: 40, humid: 60, veryHumid: 70 },
  co2: { fair: 800, poor: 1200 },
}

const TEMP_FIELDS = [
  { key: 'tooCold', prefix: '<' },
  { key: 'cool', prefix: '' },
  { key: 'warm', prefix: '' },
  { key: 'tooHot', prefix: '>' },
]
const HUMIDITY_FIELDS = [
  { key: 'veryDry', prefix: '<' },
  { key: 'dry', prefix: '' },
  { key: 'humid', prefix: '' },
  { key: 'veryHumid', prefix: '>' },
]
const CO2_FIELDS = [
  { key: 'fair', prefix: '>' },
  { key: 'poor', prefix: '>' },
]

// Drop empty subobjects so storage stays minimal
function pruneOverrides(obj) {
  const out = {}
  for (const [cat, fields] of Object.entries(obj || {})) {
    const cleaned = {}
    for (const [k, v] of Object.entries(fields || {})) {
      if (v !== '' && v != null && !Number.isNaN(v)) cleaned[k] = v
    }
    if (Object.keys(cleaned).length > 0) out[cat] = cleaned
  }
  return out
}

function ComfortSettings() {
  const { t } = useLanguage()
  const [thresholds, setThresholds] = useState({ default: DEFAULTS })
  const [activeTab, setActiveTab] = useState('default')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => { loadThresholds() }, [])

  const loadThresholds = async () => {
    try {
      setLoading(true)
      const data = normalizeThresholds(await getComfortThresholds())
      if (data) {
        const defaults = data.default || {}
        const next = {
          default: {
            temperature: { ...DEFAULTS.temperature, ...(defaults.temperature || {}) },
            humidity:    { ...DEFAULTS.humidity,    ...(defaults.humidity    || {}) },
            co2:         { ...DEFAULTS.co2,         ...(defaults.co2         || {}) },
          },
        }
        for (const type of ROOM_TYPES) {
          if (type === 'default') continue
          if (data[type]) next[type] = pruneOverrides(data[type])
        }
        setThresholds(next)
      } else {
        setThresholds({ default: DEFAULTS })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  const updateDefaultField = (category, field, raw) => {
    setThresholds(prev => ({
      ...prev,
      default: {
        ...prev.default,
        [category]: { ...prev.default[category], [field]: raw === '' ? '' : Number(raw) },
      },
    }))
  }

  const updateOverrideField = (type, category, field, raw) => {
    setThresholds(prev => {
      const existing = prev[type] || {}
      const catExisting = existing[category] || {}
      let nextCat
      if (raw === '') {
        nextCat = { ...catExisting }
        delete nextCat[field]
      } else {
        nextCat = { ...catExisting, [field]: Number(raw) }
      }
      const nextType = { ...existing }
      if (Object.keys(nextCat).length === 0) delete nextType[category]
      else nextType[category] = nextCat
      const next = { ...prev }
      if (Object.keys(nextType).length === 0) delete next[type]
      else next[type] = nextType
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      // Normalize before saving: default stays full; others pruned
      const payload = { default: thresholds.default }
      for (const type of ROOM_TYPES) {
        if (type === 'default') continue
        if (thresholds[type]) {
          const pruned = pruneOverrides(thresholds[type])
          if (Object.keys(pruned).length > 0) payload[type] = pruned
        }
      }
      await updateComfortThresholds(payload)
      setMessage({ type: 'success', text: t('settings.saved') })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const resetDefaults = () => {
    setThresholds({ default: DEFAULTS })
  }

  if (loading) {
    return (
      <div className="admin">
        <div className="admin-header">
          <h1>{t('settings.comfortTitle')}</h1>
        </div>
        <div className="loading">{t('common.loading')}</div>
      </div>
    )
  }

  const isDefaultTab = activeTab === 'default'
  const defaults = thresholds.default
  const overrides = thresholds[activeTab] || {}

  const renderField = (category, field, step, unit) => {
    const defVal = defaults[category][field.key]
    if (isDefaultTab) {
      const val = defVal
      return (
        <div key={field.key} className="threshold-row">
          <label>{t(`settings.${field.key}`)}</label>
          <div className="threshold-input-wrap">
            <span className="threshold-prefix">{field.prefix}</span>
            <input
              type="number"
              step={step}
              value={val}
              onChange={e => updateDefaultField(category, field.key, e.target.value)}
            />
            <span className="threshold-unit">{unit}</span>
          </div>
        </div>
      )
    }
    const overrideVal = overrides[category]?.[field.key]
    const isOverridden = overrideVal !== undefined
    return (
      <div key={field.key} className="threshold-row">
        <label>{t(`settings.${field.key}`)}</label>
        <div className="threshold-input-wrap">
          <span className="threshold-prefix">{field.prefix}</span>
          <input
            type="number"
            step={step}
            value={isOverridden ? overrideVal : ''}
            placeholder={String(defVal)}
            className={isOverridden ? '' : 'inheriting'}
            onChange={e => updateOverrideField(activeTab, category, field.key, e.target.value)}
          />
          <span className="threshold-unit">{unit}</span>
          <button
            type="button"
            className="reset-field-btn"
            title={t('settings.resetField')}
            disabled={!isOverridden}
            onClick={() => updateOverrideField(activeTab, category, field.key, '')}
          >↺</button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>{t('settings.comfortTitle')}</h1>
        <p>{t('settings.comfortSubtitle')}</p>
      </div>

      {message && (
        <div className={`survey-error ${message.type === 'success' ? 'survey-success' : ''}`}>
          {message.text}
        </div>
      )}

      <div className="room-type-tabs" role="tablist">
        {ROOM_TYPES.map(type => (
          <button
            key={type}
            type="button"
            role="tab"
            className={`room-type-tab ${activeTab === type ? 'active' : ''}`}
            aria-selected={activeTab === type}
            onClick={() => setActiveTab(type)}
          >
            {t(`roomType.${type}`)}
          </button>
        ))}
      </div>

      {!isDefaultTab && <p className="room-type-hint">{t('settings.roomTypeHint')}</p>}

      <form onSubmit={handleSubmit}>
        <div className="admin-section">
          <h2>{t('settings.temperature')}</h2>
          <p className="form-hint">{t('settings.temperatureHint')}</p>
          <div className="threshold-grid">
            {TEMP_FIELDS.map(f => renderField('temperature', f, '0.5', '°C'))}
          </div>
          {isDefaultTab && (
            <table className="threshold-range-table">
              <thead>
                <tr>
                  <th className="scale-bad">{t('settings.tooCold')}</th>
                  <th className="scale-warn">{t('settings.cool')}</th>
                  <th className="scale-good">{t('settings.comfortable')}</th>
                  <th className="scale-warn">{t('settings.warm')}</th>
                  <th className="scale-bad">{t('settings.tooHot')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>&lt; {defaults.temperature.tooCold}°C</td>
                  <td>{defaults.temperature.tooCold}–{defaults.temperature.cool}°C</td>
                  <td>{defaults.temperature.cool}–{defaults.temperature.warm}°C</td>
                  <td>{defaults.temperature.warm}–{defaults.temperature.tooHot}°C</td>
                  <td>&gt; {defaults.temperature.tooHot}°C</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="admin-section">
          <h2>{t('settings.humidity')}</h2>
          <p className="form-hint">{t('settings.humidityHint')}</p>
          <div className="threshold-grid">
            {HUMIDITY_FIELDS.map(f => renderField('humidity', f, '1', '%'))}
          </div>
        </div>

        <div className="admin-section">
          <h2>{t('settings.co2')}</h2>
          <p className="form-hint">{t('settings.co2Hint')}</p>
          <div className="threshold-grid">
            {[
              { ...CO2_FIELDS[0], label: 'airFresher' },
              { ...CO2_FIELDS[1], label: 'ventilate' },
            ].map(f => {
              const defVal = defaults.co2[f.key]
              if (isDefaultTab) {
                return (
                  <div key={f.key} className="threshold-row">
                    <label>{t(`settings.${f.label}`)}</label>
                    <div className="threshold-input-wrap">
                      <span className="threshold-prefix">{f.prefix}</span>
                      <input type="number" step="50" value={defVal}
                        onChange={e => updateDefaultField('co2', f.key, e.target.value)} />
                      <span className="threshold-unit">ppm</span>
                    </div>
                  </div>
                )
              }
              const overrideVal = overrides.co2?.[f.key]
              const isOverridden = overrideVal !== undefined
              return (
                <div key={f.key} className="threshold-row">
                  <label>{t(`settings.${f.label}`)}</label>
                  <div className="threshold-input-wrap">
                    <span className="threshold-prefix">{f.prefix}</span>
                    <input
                      type="number" step="50"
                      value={isOverridden ? overrideVal : ''}
                      placeholder={String(defVal)}
                      className={isOverridden ? '' : 'inheriting'}
                      onChange={e => updateOverrideField(activeTab, 'co2', f.key, e.target.value)}
                    />
                    <span className="threshold-unit">ppm</span>
                    <button
                      type="button"
                      className="reset-field-btn"
                      title={t('settings.resetField')}
                      disabled={!isOverridden}
                      onClick={() => updateOverrideField(activeTab, 'co2', f.key, '')}
                    >↺</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="form-actions">
          {isDefaultTab && (
            <button type="button" className="cancel-btn" onClick={resetDefaults}>
              {t('settings.resetDefaults')}
            </button>
          )}
          <button type="submit" className="send-btn" disabled={saving}>
            {saving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ComfortSettings
