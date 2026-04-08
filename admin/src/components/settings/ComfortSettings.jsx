import { useState, useEffect } from 'react'
import { getComfortThresholds, updateComfortThresholds } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'

const DEFAULTS = {
  temperature: { tooCold: 17, cool: 19, warm: 23, tooHot: 26 },
  humidity: { veryDry: 30, dry: 40, humid: 60, veryHumid: 70 },
  co2: { fair: 800, poor: 1200 },
}

function ComfortSettings() {
  const { t } = useLanguage()
  const [thresholds, setThresholds] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadThresholds()
  }, [])

  const loadThresholds = async () => {
    try {
      setLoading(true)
      const data = await getComfortThresholds()
      if (data) {
        setThresholds({
          temperature: { ...DEFAULTS.temperature, ...data.temperature },
          humidity: { ...DEFAULTS.humidity, ...data.humidity },
          co2: { ...DEFAULTS.co2, ...data.co2 },
        })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (category, field, value) => {
    setThresholds(prev => ({
      ...prev,
      [category]: { ...prev[category], [field]: value === '' ? '' : Number(value) }
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await updateComfortThresholds(thresholds)
      setMessage({ type: 'success', text: t('settings.saved') })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const resetDefaults = () => {
    setThresholds(DEFAULTS)
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

      <form onSubmit={handleSubmit}>
        <div className="admin-section">
          <h2>{t('settings.temperature')}</h2>
          <p className="form-hint">{t('settings.temperatureHint')}</p>
          <div className="threshold-grid">
            <div className="threshold-row">
              <label>{t('settings.tooCold')}</label>
              <div className="threshold-input-wrap">
                <span className="threshold-prefix">&lt;</span>
                <input type="number" step="0.5" value={thresholds.temperature.tooCold} onChange={(e) => handleChange('temperature', 'tooCold', e.target.value)} />
                <span className="threshold-unit">°C</span>
              </div>
            </div>
            <div className="threshold-row">
              <label>{t('settings.cool')}</label>
              <div className="threshold-input-wrap">
                <input type="number" step="0.5" value={thresholds.temperature.cool} onChange={(e) => handleChange('temperature', 'cool', e.target.value)} />
                <span className="threshold-unit">°C</span>
              </div>
            </div>
            <div className="threshold-row">
              <label>{t('settings.warm')}</label>
              <div className="threshold-input-wrap">
                <input type="number" step="0.5" value={thresholds.temperature.warm} onChange={(e) => handleChange('temperature', 'warm', e.target.value)} />
                <span className="threshold-unit">°C</span>
              </div>
            </div>
            <div className="threshold-row">
              <label>{t('settings.tooHot')}</label>
              <div className="threshold-input-wrap">
                <span className="threshold-prefix">&gt;</span>
                <input type="number" step="0.5" value={thresholds.temperature.tooHot} onChange={(e) => handleChange('temperature', 'tooHot', e.target.value)} />
                <span className="threshold-unit">°C</span>
              </div>
            </div>
          </div>
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
                <td>&lt; {thresholds.temperature.tooCold}°C</td>
                <td>{thresholds.temperature.tooCold}–{thresholds.temperature.cool}°C</td>
                <td>{thresholds.temperature.cool}–{thresholds.temperature.warm}°C</td>
                <td>{thresholds.temperature.warm}–{thresholds.temperature.tooHot}°C</td>
                <td>&gt; {thresholds.temperature.tooHot}°C</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="admin-section">
          <h2>{t('settings.humidity')}</h2>
          <p className="form-hint">{t('settings.humidityHint')}</p>
          <div className="threshold-grid">
            <div className="threshold-row">
              <label>{t('settings.veryDry')}</label>
              <div className="threshold-input-wrap">
                <span className="threshold-prefix">&lt;</span>
                <input type="number" step="1" value={thresholds.humidity.veryDry} onChange={(e) => handleChange('humidity', 'veryDry', e.target.value)} />
                <span className="threshold-unit">%</span>
              </div>
            </div>
            <div className="threshold-row">
              <label>{t('settings.dry')}</label>
              <div className="threshold-input-wrap">
                <input type="number" step="1" value={thresholds.humidity.dry} onChange={(e) => handleChange('humidity', 'dry', e.target.value)} />
                <span className="threshold-unit">%</span>
              </div>
            </div>
            <div className="threshold-row">
              <label>{t('settings.humid')}</label>
              <div className="threshold-input-wrap">
                <input type="number" step="1" value={thresholds.humidity.humid} onChange={(e) => handleChange('humidity', 'humid', e.target.value)} />
                <span className="threshold-unit">%</span>
              </div>
            </div>
            <div className="threshold-row">
              <label>{t('settings.veryHumid')}</label>
              <div className="threshold-input-wrap">
                <span className="threshold-prefix">&gt;</span>
                <input type="number" step="1" value={thresholds.humidity.veryHumid} onChange={(e) => handleChange('humidity', 'veryHumid', e.target.value)} />
                <span className="threshold-unit">%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-section">
          <h2>{t('settings.co2')}</h2>
          <p className="form-hint">{t('settings.co2Hint')}</p>
          <div className="threshold-grid">
            <div className="threshold-row">
              <label>{t('settings.airFresher')}</label>
              <div className="threshold-input-wrap">
                <span className="threshold-prefix">&gt;</span>
                <input type="number" step="50" value={thresholds.co2.fair} onChange={(e) => handleChange('co2', 'fair', e.target.value)} />
                <span className="threshold-unit">ppm</span>
              </div>
            </div>
            <div className="threshold-row">
              <label>{t('settings.ventilate')}</label>
              <div className="threshold-input-wrap">
                <span className="threshold-prefix">&gt;</span>
                <input type="number" step="50" value={thresholds.co2.poor} onChange={(e) => handleChange('co2', 'poor', e.target.value)} />
                <span className="threshold-unit">ppm</span>
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={resetDefaults}>
            {t('settings.resetDefaults')}
          </button>
          <button type="submit" className="send-btn" disabled={saving}>
            {saving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ComfortSettings
