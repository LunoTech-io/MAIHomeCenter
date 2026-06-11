import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

function Login() {
  const { login, error: authError } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()
  // prefilled by the house deep link route (e.g. maihome.nl/wonenlimburg1)
  const [form, setForm] = useState({ houseId: location.state?.houseId || '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.houseId || !form.password) {
      setError(t('login.error'))
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
          <h1>{t('login.title')}</h1>
          <p>{t('login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {(error || authError) && (
            <div className="login-error" id="login-error" role="alert">
              {error || authError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="houseId">{t('login.houseId')}</label>
            <input
              type="text"
              id="houseId"
              name="houseId"
              value={form.houseId}
              onChange={handleChange}
              placeholder={t('login.houseIdPlaceholder')}
              autoComplete="username"
              required
              aria-describedby={(error || authError) ? 'login-error' : undefined}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('login.password')}</label>
            <input
              type="password"
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>

        </form>
      </div>
    </div>
  )
}

export default Login
