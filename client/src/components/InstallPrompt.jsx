import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

function InstallPrompt() {
  const { t } = useLanguage()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('installPromptDismissed', 'true')
  }

  useEffect(() => {
    if (localStorage.getItem('installPromptDismissed') === 'true') {
      setShowPrompt(false)
    }
  }, [])

  if (!showPrompt) return null

  return (
    <div className="install-prompt">
      <p>{t('install.message')}</p>
      <div className="install-prompt-actions">
        <button className="install-btn" onClick={handleInstall}>
          {t('install.install')}
        </button>
        <button className="dismiss-btn" onClick={handleDismiss}>
          {t('install.notNow')}
        </button>
      </div>
    </div>
  )
}

export default InstallPrompt
