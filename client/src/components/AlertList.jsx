import { useState, useEffect } from 'react'
import { getMyAlerts, markAlertRead, markAllAlertsRead } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'

function formatRelativeTime(isoString, t) {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('common.justNow')
  if (minutes < 60) return `${minutes}${t('common.mAgo')}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}${t('common.hAgo')}`
  const days = Math.floor(hours / 24)
  return `${days}${t('common.dAgo')}`
}

function AlertList() {
  const { t } = useLanguage()
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
          <h1>{t('alerts.title')}</h1>
        </div>
        <div className="loading">{t('common.loadingAlerts')}</div>
      </div>
    )
  }

  return (
    <div className="survey-list-page">
      <div className="page-header">
        <h1>{t('alerts.title')}</h1>
        <p>
          {unreadCount > 0
            ? `${unreadCount} ${unreadCount !== 1 ? t('alerts.unreads') : t('alerts.unread')}`
            : t('alerts.recentAlerts')}
        </p>
        {unreadCount > 0 && (
          <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
            {t('alerts.markAllRead')}
          </button>
        )}
      </div>

      {error && (
        <div className="error-message" role="alert">{error}</div>
      )}

      {alerts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔔</div>
          <h2>{t('alerts.empty')}</h2>
          <p>{t('alerts.emptyDesc')}</p>
        </div>
      ) : (
        <div className="survey-cards" role="list" aria-label={t('alerts.title')}>
          {alerts.map(a => {
            const isUnread = !a.is_read
            return isUnread ? (
              <button
                key={a.id}
                className={`survey-card alert-card-unread alert-card-interactive`}
                onClick={() => handleCardClick(a)}
                aria-label={`${t('alerts.markAsRead')}: ${a.title}`}
              >
                <h2 className="alert-title">{a.title}</h2>
                {a.body && <p className="survey-description">{a.body}</p>}
                <div className="survey-card-meta">
                  {a.room_name && <span>{a.room_name}</span>}
                  <span>{formatRelativeTime(a.created_at, t)}</span>
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
                  <span>{formatRelativeTime(a.created_at, t)}</span>
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
