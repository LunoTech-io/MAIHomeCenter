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
    needsInstall,
    isiOSDevice
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
      setStatus({ type: 'success', message: 'Notifications enabled!' })
    } else {
      setStatus({ type: 'error', message: result.error || 'Failed to enable notifications' })
    }
  }

  // Already subscribed — nothing to show
  if (isSubscribed) return null

  // iOS needs PWA installed first
  if (needsInstall) {
    return (
      <div className="notification-section">
        <h2>Notifications</h2>
        <div className="notification-status ios-install">
          <strong>To enable notifications on iOS:</strong>
          <ol>
            <li>Tap the Share button at the bottom of Safari</li>
            <li>Scroll down and tap "Add to Home Screen"</li>
            <li>Open the app from your Home Screen</li>
            <li>Then enable notifications</li>
          </ol>
        </div>
      </div>
    )
  }

  // Not supported
  if (!isSupported) return null

  // Permission denied
  if (permission === 'denied') {
    return (
      <div className="notification-section">
        <h2>Notifications</h2>
        <div className="notification-status error">
          Notifications are blocked. Please enable them in your browser settings.
        </div>
      </div>
    )
  }

  // Not subscribed — show enable button
  return (
    <div className="notification-section">
      <h2>Notifications</h2>
      <button
        className="notification-btn enable"
        onClick={handleEnable}
        disabled={isLoading}
      >
        {isLoading ? 'Enabling...' : 'Enable Notifications'}
      </button>

      <div aria-live="polite" role="status">
        {status && (
          <div className={`notification-status ${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationButton
