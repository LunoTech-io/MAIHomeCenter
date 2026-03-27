import { useState, useEffect } from 'react'
import usePushNotifications from '../hooks/usePushNotifications'
import { useLanguage } from '../contexts/LanguageContext'

function NotificationButton() {
  const { t } = useLanguage()
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    needsInstall,
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
      setStatus({ type: 'success', message: t('notif.enabled') })
    } else {
      setStatus({ type: 'error', message: result.error || t('notif.failed') })
    }
  }

  if (isSubscribed) return null

  if (needsInstall) {
    return (
      <div className="notification-section">
        <h2>{t('nav.alerts')}</h2>
        <div className="notification-status ios-install">
          <strong>{t('notif.iosTitle')}</strong>
          <ol>
            <li>{t('notif.iosStep1')}</li>
            <li>{t('notif.iosStep2')}</li>
            <li>{t('notif.iosStep3')}</li>
            <li>{t('notif.iosStep4')}</li>
          </ol>
        </div>
      </div>
    )
  }

  if (!isSupported) return null

  if (permission === 'denied') {
    return (
      <div className="notification-section">
        <h2>{t('nav.alerts')}</h2>
        <div className="notification-status error">
          {t('notif.blocked')}
        </div>
      </div>
    )
  }

  return (
    <div className="notification-section">
      <h2>{t('nav.alerts')}</h2>
      <button
        className="notification-btn enable"
        onClick={handleEnable}
        disabled={isLoading}
      >
        {isLoading ? t('notif.enabling') : t('notif.enable')}
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
