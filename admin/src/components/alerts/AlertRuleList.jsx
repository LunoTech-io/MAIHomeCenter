import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAlertRules, deleteAlertRule } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'

const SENSOR_UNITS = {
  temperature: '\u00B0C',
  humidity: '%',
  co2: 'ppm',
  tvoc: 'ppb',
  pressure: 'hPa',
  light_level: 'lux'
}

function AlertRuleList() {
  const { t } = useLanguage()
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const formatCondition = (c) => {
    const field = t(`sensor.${c.sensorField}`) || c.sensorField
    const op = t(`sensor.${c.operator}`) || c.operator
    const unit = SENSOR_UNITS[c.sensorField] || ''
    return `${field} ${op} ${c.threshold}${unit}`
  }

  const formatConditions = (rule) => {
    const conditions = rule.conditions || []
    const parts = conditions.map(formatCondition)
    const duration = rule.sustained_minutes > 0 ? ` for ${rule.sustained_minutes}m` : ''
    return parts.join(' AND ') + duration
  }

  useEffect(() => {
    loadRules()
  }, [])

  const loadRules = async () => {
    try {
      setLoading(true)
      const data = await getAlertRules()
      setRules(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('alertRules.deleteConfirm'))) return

    try {
      await deleteAlertRule(id)
      setRules(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) {
    return (
      <div className="admin">
        <div className="admin-header">
          <h1>{t('alertRules.title')}</h1>
        </div>
        <div className="loading">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>{t('alertRules.title')}</h1>
        <p>{t('alertRules.subtitle')}</p>
      </div>

      {error && (
        <div className="result-message error" style={{ position: 'static', marginBottom: '16px' }}>{error}</div>
      )}

      <div className="admin-section">
        <div className="section-header">
          <h2>{t('alertRules.rules')} ({rules.length})</h2>
          <Link to="/alerts/new" className="send-btn">{t('alertRules.newRule')}</Link>
        </div>

        {rules.length === 0 ? (
          <p className="no-subscribers">{t('alertRules.noRules')}</p>
        ) : (
          <div className="houses-table-wrap">
            <table className="houses-table">
              <thead>
                <tr>
                  <th>{t('alertRules.name')}</th>
                  <th>{t('alertRules.condition')}</th>
                  <th>{t('alertRules.active')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id}>
                    <td><strong>{rule.name}</strong></td>
                    <td>{formatConditions(rule)}</td>
                    <td>
                      <span className={rule.is_active ? 'status-active' : 'status-inactive'}>
                        {rule.is_active ? t('alertRules.active') : t('alertRules.inactive')}
                      </span>
                    </td>
                    <td className="house-actions-cell">
                      <Link to={`/alerts/${rule.id}`} className="action-btn-small edit">
                        {t('surveys.edit')}
                      </Link>
                      <button
                        className="action-btn-small delete"
                        onClick={() => handleDelete(rule.id)}
                      >
                        {t('surveys.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default AlertRuleList
