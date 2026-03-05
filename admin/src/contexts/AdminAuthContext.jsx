import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { adminLogin as apiAdminLogin, getAdminMe } from '../services/api'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('adminToken')
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const adminData = await getAdminMe()
      if (adminData) {
        setAdmin(adminData)
      } else {
        localStorage.removeItem('adminToken')
      }
    } catch (err) {
      console.error('Admin auth check failed:', err)
      localStorage.removeItem('adminToken')
    } finally {
      setLoading(false)
    }
  }

  const login = useCallback(async (username, password) => {
    setError(null)

    try {
      const result = await apiAdminLogin(username, password)
      localStorage.setItem('adminToken', result.token)
      setAdmin(result.admin)
      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('adminToken')
    setAdmin(null)
    setError(null)
  }, [])

  const value = {
    admin,
    isAuthenticated: !!admin,
    loading,
    error,
    login,
    logout
  }

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}

export default AdminAuthContext
