import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login as apiLogin, getCurrentHouse, linkSubscriptionToHouse } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [house, setHouse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check for existing session on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('authToken')
    if (!token) {
      setLoading(false)
      return
    }

    // Restore demo session without hitting the server
    if (token === 'demo') {
      const demoId = localStorage.getItem('demoHouseId') || 'woning16'
      setHouse({ id: 'demo', houseId: demoId, name: `Demo ${demoId}` })
      setLoading(false)
      return
    }

    try {
      const houseData = await getCurrentHouse()
      if (houseData) {
        setHouse(houseData)
      } else {
        // Token invalid, clear it
        localStorage.removeItem('authToken')
      }
    } catch (err) {
      console.error('Auth check failed:', err)
      localStorage.removeItem('authToken')
    } finally {
      setLoading(false)
    }
  }

  const login = useCallback(async (houseId, password) => {
    setError(null)

    try {
      const result = await apiLogin(houseId, password)
      localStorage.setItem('authToken', result.token)
      setHouse(result.house)

      // Try to link existing push subscription to this house
      linkExistingSubscription()

      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    }
  }, [])

  const demoLogin = useCallback((houseId = 'woning16', name = 'Demo Home') => {
    localStorage.setItem('authToken', 'demo')
    localStorage.setItem('demoHouseId', houseId)
    setHouse({ id: 'demo', houseId, name })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('demoHouseId')
    setHouse(null)
    setError(null)
  }, [])

  const linkExistingSubscription = async () => {
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
          await linkSubscriptionToHouse(subscription.endpoint)
        }
      }
    } catch (err) {
      console.warn('Failed to link subscription:', err)
    }
  }

  const value = {
    house,
    isAuthenticated: !!house,
    loading,
    error,
    login,
    demoLogin,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
