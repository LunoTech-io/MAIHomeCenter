import { useState, useEffect } from 'react'
import { getMyAlerts, markAlertRead, markAllAlertsRead } from '../services/api'

function formatRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function AlertList() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadAlerts()
  }, [])

  const loadAlerts = async () => {
    try {
      setLoading(true)
      const data = await getMyAlerts()
      setAlerts(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const unreadCount = alerts.filter(a => !a.is_read).length

  const handleCardClick = async (alert) => {
    if (alert.is_read) return
    setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, is_read: true } : a))
    try {
      await markAlertRead(alert.id)
    } catch {
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, is_read: false } : a))
    }
  }

  const handleMarkAllRead = async () => {
    const previousAlerts = alerts
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
    try {
      await markAllAlertsRead()
    } catch {
      setAlerts(previousAlerts)
    }
  }

  if (loading) {
    return (
      <div className="survey-list-page">
        <div className="page-header">
          <h1>Alerts</h1>
        </div>
        <div className="loading">Loading alerts...</div>
      </div>
    )
  }

  return (
    <div className="survey-list-page">
      <div className="page-header">
        <h1>Alerts</h1>
        <p>
          {unreadCount > 0
            ? `${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}`
            : 'Recent alert notifications for your home'}
        </p>
        {unreadCount > 0 && (
          <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
            Mark all as read
          </button>
        )}
      </div>

      {error && (
        <div className="error-message" role="alert">{error}</div>
      )}

      {alerts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔔</div>
          <h2>No alerts yet</h2>
          <p>Alert notifications will appear here when triggered.</p>
        </div>
      ) : (
        <div className="survey-cards" role="list" aria-label="Alert notifications">
          {alerts.map(a => {
            const isUnread = !a.is_read
            return isUnread ? (
              <button
                key={a.id}
                className={`survey-card alert-card-unread alert-card-interactive`}
                onClick={() => handleCardClick(a)}
                aria-label={`Mark as read: ${a.title}`}
              >
                <h2 className="alert-title">{a.title}</h2>
                {a.body && <p className="survey-description">{a.body}</p>}
                <div className="survey-card-meta">
                  {a.room_name && <span>{a.room_name}</span>}
                  <span>{formatRelativeTime(a.created_at)}</span>
                </div>
              </button>
            ) : (
              <div
                key={a.id}
                className="survey-card alert-card-read"
                role="listitem"
              >
                <h2 className="alert-title">{a.title}</h2>
                {a.body && <p className="survey-description">{a.body}</p>}
                <div className="survey-card-meta">
                  {a.room_name && <span>{a.room_name}</span>}
                  <span>{formatRelativeTime(a.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AlertList
