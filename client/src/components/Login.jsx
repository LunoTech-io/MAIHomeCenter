import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const demoHouses = [
  { id: 'woning16', name: 'WONING 16' },
  { id: 'weller1', name: 'Weller 1' },
  { id: 'wonenzuid1', name: 'Wonen Zuid 1' },
  { id: 'wonenlimburg1', name: 'Wonen in Limburg 1' },
]

function Login() {
  const { login, demoLogin, error: authError } = useAuth()
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
          <p>Sign in to access your dashboard</p>
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

          <div className="demo-divider"><span>or try a demo house</span></div>

          <div className="demo-house-grid">
            {demoHouses.map((h) => (
              <button
                key={h.id}
                type="button"
                className="demo-house-btn"
                onClick={() => demoLogin(h.id, h.name)}
              >
                <span className="demo-house-name">{h.name}</span>
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login
