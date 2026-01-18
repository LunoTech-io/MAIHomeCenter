import { useState, useEffect } from 'react'
import { getNotificationStats, broadcastNotification } from '../services/api'

function Admin() {
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
    const interval = setInterval(loadStats, 10000)
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
        message: `Sent to ${response.sent} subscriber(s)${response.failed > 0 ? `, ${response.failed} failed` : ''}`
      })
      setForm({ title: '', body: '', url: '/' })
    } catch (err) {
      setResult({
        type: 'error',
        message: err.message || 'Failed to send notification'
      })
    } finally {
      setSending(false)
    }
  }

  const handleQuickNotification = async (type) => {
    const notifications = {
      alert: { title: 'Security Alert', body: 'Motion detected at front door' },
      reminder: { title: 'Reminder', body: 'Don\'t forget to check the thermostat' },
      update: { title: 'System Update', body: 'MAIHomeCenter has been updated' }
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
        message: `Sent "${notification.title}" to ${response.sent} subscriber(s)`
      })
    } catch (err) {
      setResult({
        type: 'error',
        message: err.message || 'Failed to send notification'
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>MAIHomeCenter Admin</h1>
        <p>Send notifications to subscribers</p>
      </header>

      <div className="stats-card">
        <div className="stat">
          <span className="stat-value">{stats.subscriptions}</span>
          <span className="stat-label">Active Subscribers</span>
        </div>
      </div>

      <div className="admin-section">
        <h2>Quick Notifications</h2>
        <div className="quick-notifications">
          <button
            className="quick-btn alert"
            onClick={() => handleQuickNotification('alert')}
            disabled={sending || stats.subscriptions === 0}
          >
            🚨 Security Alert
          </button>
          <button
            className="quick-btn reminder"
            onClick={() => handleQuickNotification('reminder')}
            disabled={sending || stats.subscriptions === 0}
          >
            ⏰ Reminder
          </button>
          <button
            className="quick-btn update"
            onClick={() => handleQuickNotification('update')}
            disabled={sending || stats.subscriptions === 0}
          >
            🔄 System Update
          </button>
        </div>
      </div>

      <div className="admin-section">
        <h2>Custom Notification</h2>
        <form onSubmit={handleSubmit} className="notification-form">
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Notification title"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="body">Message</label>
            <textarea
              id="body"
              name="body"
              value={form.body}
              onChange={handleChange}
              placeholder="Notification message"
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="url">Link URL (optional)</label>
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
            {sending ? 'Sending...' : `Send to ${stats.subscriptions} Subscriber(s)`}
          </button>
        </form>

        {stats.subscriptions === 0 && (
          <p className="no-subscribers">
            No subscribers yet. Users need to enable notifications on the client app first.
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
