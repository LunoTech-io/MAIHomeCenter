import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

const demoHouses = [
  { id: 'woning16', name: 'WONING 16' },
  { id: 'weller1', name: 'Weller 1' },
  { id: 'wonenzuid1', name: 'Wonen Zuid 1' },
  { id: 'wonenlimburg1', name: 'Wonen in Limburg 1' },
]

function Login() {
  const { login, demoLogin, error: authError } = useAuth()
  const { t } = useLanguage()
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

          <div className="demo-divider"><span>{t('login.demoHouses')}</span></div>

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
