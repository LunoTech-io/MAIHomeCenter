import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

function Login() {
  const { login, error: authError } = useAuth()
  const [form, setForm] = useState({ houseId: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.houseId || !form.password) {
      setError('Please enter your house ID and password')
      return
    }

    setLoading(true)
    setError(null)

    const result = await login(form.houseId, form.password)

    if (!result.success) {
      setError(result.error)
    }

    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>MAIHomeCenter</h1>
          <p>Sign in to access your surveys</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {(error || authError) && (
            <div className="login-error">
              {error || authError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="houseId">House ID</label>
            <input
              type="text"
              id="houseId"
              name="houseId"
              value={form.houseId}
              onChange={handleChange}
              placeholder="Enter your house ID"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
