import { useState, useEffect } from 'react'
import { getNotificationStats, broadcastNotification } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'

function Admin() {
  const { t } = useLanguage()
  const [stats, setStats] = useState({ subscriptions: 0 })
  const [form, setForm] = useState({
    title: '',
    body: '',
    url: '/'
  })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      const data = await getNotificationStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title || !form.body) return

    setSending(true)
    setResult(null)

    try {
      const response = await broadcastNotification({
        title: form.title,
        body: form.body,
        url: form.url || '/'
      })
      setResult({
        type: 'success',
        message: t('admin.sentTo').replace('{sent}', response.sent) + (response.failed > 0 ? t('admin.sentFailed').replace('{failed}', response.failed) : '')
      })
      setForm({ title: '', body: '', url: '/' })
    } catch (err) {
      setResult({
        type: 'error',
        message: err.message || t('admin.sendFailed')
      })
    } finally {
      setSending(false)
    }
  }

  const handleQuickNotification = async (type) => {
    const notifications = {
      alert: { title: t('admin.securityAlert'), body: t('admin.securityAlertBody') },
      reminder: { title: t('admin.reminder'), body: t('admin.reminderBody') },
      update: { title: t('admin.systemUpdate'), body: t('admin.systemUpdateBody') }
    }

    const notification = notifications[type]
    if (!notification) return

    setSending(true)
    setResult(null)

    try {
      const response = await broadcastNotification({
        ...notification,
        url: '/'
      })
      setResult({
        type: 'success',
        message: t('admin.sentQuick').replace('{title}', notification.title).replace('{sent}', response.sent)
      })
    } catch (err) {
      setResult({
        type: 'error',
        message: err.message || t('admin.sendFailed')
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>{t('admin.title')}</h1>
        <p>{t('admin.subtitle')}</p>
      </header>

      <div className="stats-card">
        <div className="stat">
          <span className="stat-value">{stats.subscriptions}</span>
          <span className="stat-label">{t('admin.activeSubscribers')}</span>
        </div>
      </div>

      <div className="admin-section">
        <h2>{t('admin.quickNotifications')}</h2>
        <div className="quick-notifications">
          <button
            className="quick-btn alert"
            onClick={() => handleQuickNotification('alert')}
            disabled={sending || stats.subscriptions === 0}
          >
            🚨 {t('admin.securityAlert')}
          </button>
          <button
            className="quick-btn reminder"
            onClick={() => handleQuickNotification('reminder')}
            disabled={sending || stats.subscriptions === 0}
          >
            ⏰ {t('admin.reminder')}
          </button>
          <button
            className="quick-btn update"
            onClick={() => handleQuickNotification('update')}
            disabled={sending || stats.subscriptions === 0}
          >
            🔄 {t('admin.systemUpdate')}
          </button>
        </div>
      </div>

      <div className="admin-section">
        <h2>{t('admin.customNotification')}</h2>
        <form onSubmit={handleSubmit} className="notification-form">
          <div className="form-group">
            <label htmlFor="title">{t('admin.title_field')}</label>
            <input
              type="text"
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder={t('admin.notifTitlePlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="body">{t('admin.message')}</label>
            <textarea
              id="body"
              name="body"
              value={form.body}
              onChange={handleChange}
              placeholder={t('admin.notifBodyPlaceholder')}
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="url">{t('admin.linkUrl')}</label>
            <input
              type="text"
              id="url"
              name="url"
              value={form.url}
              onChange={handleChange}
              placeholder="/"
            />
          </div>

          <button
            type="submit"
            className="send-btn"
            disabled={sending || stats.subscriptions === 0}
          >
            {sending ? t('admin.sending') : `${t('admin.sendTo')} ${stats.subscriptions} ${t('admin.subscribers')}`}
          </button>
        </form>

        {stats.subscriptions === 0 && (
          <p className="no-subscribers">
            {t('admin.noSubscribers')}
          </p>
        )}
      </div>

      {result && (
        <div className={`result-message ${result.type}`}>
          {result.message}
        </div>
      )}
    </div>
  )
}

export default Admin
