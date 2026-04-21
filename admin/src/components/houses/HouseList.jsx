import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHouses, createHouse, deleteHouse, getHouseAlertSummary } from '../../services/api'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import HouseEditModal from './HouseEditModal'

function HouseList() {
  const { admin } = useAdminAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [houses, setHouses] = useState([])
  const [alertSummary, setAlertSummary] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    houseId: '',
    password: '',
    name: '',
    organization: admin?.organization || 'ou'
  })
  const [saving, setSaving] = useState(false)
  const [editingHouse, setEditingHouse] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [housesData, summaryData] = await Promise.all([
        getHouses(),
        getHouseAlertSummary().catch(() => [])
      ])
      setHouses(housesData)
      setAlertSummary(summaryData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const alertMap = {}
  for (const s of alertSummary) {
    alertMap[s.houseId] = s
  }

  const todayCount = alertSummary.filter(s => s.alertsToday > 0).length
  const weekCount = alertSummary.filter(s => s.alertsWeek > 0).length

  const filteredHouses = houses.filter(h => {
    if (filter === 'all') return true
    const summary = alertMap[h.house_id]
    if (!summary) return false
    if (filter === 'today') return summary.alertsToday > 0
    if (filter === 'week') return summary.alertsWeek > 0
    return true
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.houseId || !form.password) {
      setError(t('houses.idAndPasswordRequired'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const newHouse = await createHouse(form)
      setHouses(prev => [newHouse, ...prev])
      setForm({ houseId: '', password: '', name: '', organization: admin?.organization || 'ou' })
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, houseId) => {
    if (!window.confirm(t('houses.deleteConfirm').replace('{houseId}', houseId))) {
      return
    }

    try {
      await deleteHouse(id)
      setHouses(prev => prev.filter(h => h.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="admin">
        <div className="admin-header">
          <h1>{t('houses.title')}</h1>
        </div>
        <div className="loading">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>{t('houses.title')}</h1>
        <p>{t('houses.subtitle')}</p>
      </div>

      {error && (
        <div className="result-message error" style={{ position: 'static', marginBottom: '16px' }}>{error}</div>
      )}

      <div className="house-filters">
        <button
          className={`house-filter-btn ${filter === 'today' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'today' ? 'all' : 'today')}
        >
          {t('houses.alertsToday')}
          {todayCount > 0 && <span className="filter-count">{todayCount}</span>}
        </button>
        <button
          className={`house-filter-btn ${filter === 'week' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'week' ? 'all' : 'week')}
        >
          {t('houses.alertsWeek')}
          {weekCount > 0 && <span className="filter-count">{weekCount}</span>}
        </button>
        <button
          className={`house-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {t('houses.allHouses')}
          <span className="filter-count">{houses.length}</span>
        </button>
      </div>

      <div className="admin-section">
        <div className="section-header">
          <h2>
            {filter === 'today' ? t('houses.withAlertsToday') : filter === 'week' ? t('houses.withAlertsWeek') : t('houses.allHouses')}
            {' '}({filteredHouses.length})
          </h2>
          <button className="send-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? t('houses.cancel') : t('houses.addHouse')}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="house-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="houseId">{t('houses.houseId')}</label>
                <input
                  type="text"
                  id="houseId"
                  name="houseId"
                  value={form.houseId}
                  onChange={handleChange}
                  placeholder={t('houses.houseIdPlaceholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">{t('houses.password')}</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder={t('houses.passwordPlaceholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="name">{t('houses.name')}</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder={t('houses.namePlaceholder')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="organization">{t('houses.organization')}</label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  value={form.organization}
                  onChange={handleChange}
                  placeholder={t('houses.organizationPlaceholder')}
                />
              </div>
            </div>

            <button type="submit" className="send-btn" disabled={saving}>
              {saving ? t('houses.creating') : t('houses.create')}
            </button>
          </form>
        )}

        {filteredHouses.length === 0 ? (
          <p className="no-subscribers">
            {filter === 'all' ? t('houses.noHouses') : t('houses.noAlertsInPeriod')}
          </p>
        ) : (
          <div className="houses-table-wrap">
            <table className="houses-table">
              <thead>
                <tr>
                  <th>{t('houses.houseId')}</th>
                  <th>{t('houses.name')}</th>
                  <th>{t('houses.alerts')}</th>
                  <th>{t('houses.points')}</th>
                  <th>{t('houses.organization')}</th>
                  <th>{t('houses.created')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredHouses.map(house => {
                  const summary = alertMap[house.house_id]
                  return (
                    <tr key={house.id}>
                      <td className="house-id-cell">{house.house_id}</td>
                      <td>{house.name || '--'}</td>
                      <td>
                        {summary ? (
                          <span className="alert-count-cell">
                            {summary.alertsToday > 0 && (
                              <span className="alert-badge today">{summary.alertsToday} {t('houses.today')}</span>
                            )}
                            {summary.alertsWeek > 0 && summary.alertsToday !== summary.alertsWeek && (
                              <span className="alert-badge week">{summary.alertsWeek} {t('houses.thisWeek')}</span>
                            )}
                          </span>
                        ) : (
                          <span className="house-date-cell">--</span>
                        )}
                      </td>
                      <td className="house-points-cell">{house.points ?? 0}</td>
                      <td><span className="house-org">{house.organization}</span></td>
                      <td className="house-date-cell">{new Date(house.created_at).toLocaleDateString()}</td>
                      <td className="house-actions-cell">
                        <button
                          className="action-btn-small view"
                          onClick={() => navigate(`/houses/${house.house_id}`)}
                        >
                          {t('houses.dashboard')}
                        </button>
                        <button
                          className="action-btn-small edit"
                          onClick={() => setEditingHouse(house)}
                        >
                          {t('houses.edit')}
                        </button>
                        <button
                          className="action-btn-small delete"
                          onClick={() => handleDelete(house.id, house.house_id)}
                        >
                          {t('houses.delete')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingHouse && (
        <HouseEditModal
          house={editingHouse}
          onClose={() => setEditingHouse(null)}
          onUpdated={(updated) => {
            setHouses(prev => prev.map(h => h.id === updated.id ? updated : h))
          }}
        />
      )}
    </div>
  )
}

export default HouseList
