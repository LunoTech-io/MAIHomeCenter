import { useState, useEffect } from 'react'
import usePushNotifications from '../hooks/usePushNotifications'

function NotificationButton() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    sendTestNotification
  } = usePushNotifications()

  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (error) {
      setStatus({ type: 'error', message: error })
    }
  }, [error])

  const handleEnable = async () => {
    setStatus(null)
    const result = await subscribe()
    if (result.success) {
      setStatus({ type: 'success', message: 'Notifications enabled successfully!' })
    } else {
      setStatus({ type: 'error', message: result.error || 'Failed to enable notifications' })
    }
  }

  const handleTest = async () => {
    setStatus(null)
    const result = await sendTestNotification()
    if (result.success) {
      setStatus({ type: 'success', message: 'Test notification sent!' })
    } else {
      setStatus({ type: 'error', message: result.error || 'Failed to send test notification' })
    }
  }

  if (!isSupported) {
    return (
      <div className="notification-status error">
        Push notifications are not supported in this browser.
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className="notification-status error">
        Notifications are blocked. Please enable them in your browser settings.
      </div>
    )
  }

  return (
    <>
      {isSubscribed ? (
        <>
          <button className="notification-btn enabled" disabled>
            <span>🔔</span>
            Notifications Enabled
          </button>
          <button
            className="notification-btn test"
            onClick={handleTest}
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send Test Notification'}
          </button>
        </>
      ) : (
        <button
          className="notification-btn enable"
          onClick={handleEnable}
          disabled={isLoading}
        >
          {isLoading ? 'Enabling...' : 'Enable Notifications'}
        </button>
      )}

      {status && (
        <div className={`notification-status ${status.type}`}>
          {status.message}
        </div>
      )}
    </>
  )
}

export default NotificationButton
