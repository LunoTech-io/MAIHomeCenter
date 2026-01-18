import { useState, useEffect } from 'react'
import { getHouses, createHouse, deleteHouse } from '../../services/api'

function HouseList() {
  const [houses, setHouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    houseId: '',
    password: '',
    name: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadHouses()
  }, [])

  const loadHouses = async () => {
    try {
      setLoading(true)
      const data = await getHouses()
      setHouses(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
      setForm({ houseId: '', password: '', name: '' })
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

      <div className="admin-section">
        <div className="section-header">
          <h2>Houses ({houses.length})</h2>
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
                  placeholder="e.g., HOUSE001"
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
            </div>

            <button type="submit" className="send-btn" disabled={saving}>
              {saving ? 'Creating...' : 'Create House'}
            </button>
          </form>
        )}

        {houses.length === 0 ? (
          <p className="no-subscribers">No houses yet. Add your first house to get started.</p>
        ) : (
          <div className="houses-list">
            {houses.map(house => (
              <div key={house.id} className="house-card">
                <div className="house-info">
                  <strong className="house-id">{house.house_id}</strong>
                  {house.name && <span className="house-name">{house.name}</span>}
                  <span className="house-date">
                    Created: {new Date(house.created_at).toLocaleDateString()}
                  </span>
                </div>
                <button
                  className="action-btn-small delete"
                  onClick={() => handleDelete(house.id, house.house_id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HouseList
