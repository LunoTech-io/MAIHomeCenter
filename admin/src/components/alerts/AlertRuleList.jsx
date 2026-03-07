import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAlertRules, deleteAlertRule } from '../../services/api'

const SENSOR_LABELS = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  co2: 'CO2',
  tvoc: 'TVOC',
  pressure: 'Pressure',
  light_level: 'Light Level'
}

const SENSOR_UNITS = {
  temperature: '\u00B0C',
  humidity: '%',
  co2: 'ppm',
  tvoc: 'ppb',
  pressure: 'hPa',
  light_level: 'lux'
}

function formatCondition(rule) {
  const field = SENSOR_LABELS[rule.sensor_field] || rule.sensor_field
  const unit = SENSOR_UNITS[rule.sensor_field] || ''
  const duration = rule.sustained_minutes > 0 ? ` for ${rule.sustained_minutes}m` : ''
  return `${field} ${rule.operator} ${rule.threshold}${unit}${duration}`
}

function AlertRuleList() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
    if (!window.confirm('Are you sure you want to delete this alert rule?')) return

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
          <h1>Alert Rules</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>Alert Rules</h1>
        <p>Automatic notifications when sensor data exceeds thresholds</p>
      </div>

      {error && (
        <div className="result-message error" style={{ position: 'static', marginBottom: '16px' }}>{error}</div>
      )}

      <div className="admin-section">
        <div className="section-header">
          <h2>Rules ({rules.length})</h2>
          <Link to="/alerts/new" className="send-btn">+ New Rule</Link>
        </div>

        {rules.length === 0 ? (
          <p className="no-subscribers">No alert rules yet. Create your first rule to get started.</p>
        ) : (
          <div className="houses-table-wrap">
            <table className="houses-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Condition</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id}>
                    <td><strong>{rule.name}</strong></td>
                    <td>{formatCondition(rule)}</td>
                    <td>
                      <span className={rule.is_active ? 'status-active' : 'status-inactive'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="house-actions-cell">
                      <Link to={`/alerts/${rule.id}`} className="action-btn-small edit">
                        Edit
                      </Link>
                      <button
                        className="action-btn-small delete"
                        onClick={() => handleDelete(rule.id)}
                      >
                        Delete
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
