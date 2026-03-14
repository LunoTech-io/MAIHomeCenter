import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHouses, createHouse, deleteHouse, getHouseAlertSummary } from '../../services/api'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

function HouseList() {
  const { admin } = useAdminAuth()
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
      setError('House ID and password are required')
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
    if (!window.confirm(`Are you sure you want to delete house "${houseId}"? This will also remove all survey assignments for this house.`)) {
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
          <h1>Houses</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>Houses</h1>
        <p>Manage tenant houses for surveys</p>
      </div>

      {error && (
        <div className="result-message error" style={{ position: 'static', marginBottom: '16px' }}>{error}</div>
      )}

      <div className="house-filters">
        <button
          className={`house-filter-btn ${filter === 'today' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'today' ? 'all' : 'today')}
        >
          Alerts today
          {todayCount > 0 && <span className="filter-count">{todayCount}</span>}
        </button>
        <button
          className={`house-filter-btn ${filter === 'week' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'week' ? 'all' : 'week')}
        >
          Alerts this week
          {weekCount > 0 && <span className="filter-count">{weekCount}</span>}
        </button>
        <button
          className={`house-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All houses
          <span className="filter-count">{houses.length}</span>
        </button>
      </div>

      <div className="admin-section">
        <div className="section-header">
          <h2>
            {filter === 'today' ? 'Houses with alerts today' : filter === 'week' ? 'Houses with alerts this week' : 'All houses'}
            {' '}({filteredHouses.length})
          </h2>
          <button className="send-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add House'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="house-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="houseId">House ID</label>
                <input
                  type="text"
                  id="houseId"
                  name="houseId"
                  value={form.houseId}
                  onChange={handleChange}
                  placeholder="e.g., weller1"
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
                  placeholder="Login password"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="name">Name (optional)</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Display name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="organization">Organization</label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  value={form.organization}
                  onChange={handleChange}
                  placeholder="e.g., ou"
                />
              </div>
            </div>

            <button type="submit" className="send-btn" disabled={saving}>
              {saving ? 'Creating...' : 'Create House'}
            </button>
          </form>
        )}

        {filteredHouses.length === 0 ? (
          <p className="no-subscribers">
            {filter === 'all' ? 'No houses yet. Add your first house to get started.' : 'No houses with alerts in this period.'}
          </p>
        ) : (
          <div className="houses-table-wrap">
            <table className="houses-table">
              <thead>
                <tr>
                  <th>House ID</th>
                  <th>Name</th>
                  <th>Alerts</th>
                  <th>Organization</th>
                  <th>Created</th>
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
                              <span className="alert-badge today">{summary.alertsToday} today</span>
                            )}
                            {summary.alertsWeek > 0 && summary.alertsToday !== summary.alertsWeek && (
                              <span className="alert-badge week">{summary.alertsWeek} this week</span>
                            )}
                          </span>
                        ) : (
                          <span className="house-date-cell">--</span>
                        )}
                      </td>
                      <td><span className="house-org">{house.organization}</span></td>
                      <td className="house-date-cell">{new Date(house.created_at).toLocaleDateString()}</td>
                      <td className="house-actions-cell">
                        <button
                          className="action-btn-small view"
                          onClick={() => navigate(`/houses/${house.house_id}`)}
                        >
                          Dashboard
                        </button>
                        <button
                          className="action-btn-small delete"
                          onClick={() => handleDelete(house.id, house.house_id)}
                        >
                          Delete
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
    </div>
  )
}

export default HouseList
