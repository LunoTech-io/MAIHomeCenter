import { useState, useEffect } from 'react'

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      // Prevent the default browser prompt
      e.preventDefault()
      // Store the event for later use
      setDeferredPrompt(e)
      // Show our custom prompt
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    // Show the browser's install prompt
    deferredPrompt.prompt()

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt')
    } else {
      console.log('User dismissed the install prompt')
    }

    // Clear the deferred prompt
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Optionally store in localStorage to not show again
    localStorage.setItem('installPromptDismissed', 'true')
  }

  // Check if user previously dismissed
  useEffect(() => {
    if (localStorage.getItem('installPromptDismissed') === 'true') {
      setShowPrompt(false)
    }
  }, [])

  if (!showPrompt) return null

  return (
    <div className="install-prompt">
      <p>Install MAIHomeCenter for quick access!</p>
      <div className="install-prompt-actions">
        <button className="install-btn" onClick={handleInstall}>
          Install
        </button>
        <button className="dismiss-btn" onClick={handleDismiss}>
          Not now
        </button>
      </div>
    </div>
  )
}

export default InstallPrompt
