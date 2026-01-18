import { useState, useEffect } from 'react'
import { getHouses, sendSurvey } from '../../services/api'

function SendSurveyModal({ survey, onClose }) {
  const [houses, setHouses] = useState([])
  const [selectedHouses, setSelectedHouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

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

  const toggleHouse = (houseId) => {
    setSelectedHouses(prev =>
      prev.includes(houseId)
        ? prev.filter(id => id !== houseId)
        : [...prev, houseId]
    )
  }

  const selectAll = () => {
    setSelectedHouses(houses.map(h => h.id))
  }

  const selectNone = () => {
    setSelectedHouses([])
  }

  const handleSend = async () => {
    if (selectedHouses.length === 0) {
      setError('Please select at least one house')
      return
    }

    setSending(true)
    setError(null)
    setResult(null)

    try {
      const response = await sendSurvey(survey.id, selectedHouses)
      setResult(response)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Send Survey</h2>
          <button className="modal-close" onClick={onClose}>X</button>
        </div>

        <div className="modal-body">
          <p className="survey-title-display">
            <strong>{survey.title}</strong>
          </p>

          {loading ? (
            <div className="loading">Loading houses...</div>
          ) : error && !result ? (
            <div className="error-message">{error}</div>
          ) : result ? (
            <div className="send-result">
              <div className="result-success">
                <p>Survey sent successfully!</p>
                <ul>
                  <li>{result.assignmentsCreated} assignment(s) created</li>
                  <li>{result.notificationsSent} notification(s) sent</li>
                  {result.notificationsFailed > 0 && (
                    <li className="text-warning">{result.notificationsFailed} notification(s) failed</li>
                  )}
                </ul>
              </div>
              <button className="send-btn" onClick={onClose}>Close</button>
            </div>
          ) : (
            <>
              <div className="house-selection">
                <div className="selection-controls">
                  <button type="button" className="link-btn" onClick={selectAll}>Select All</button>
                  <button type="button" className="link-btn" onClick={selectNone}>Select None</button>
                  <span className="selection-count">{selectedHouses.length} selected</span>
                </div>

                {houses.length === 0 ? (
                  <p className="no-subscribers">No houses found. Create houses first.</p>
                ) : (
                  <div className="house-list">
                    {houses.map(house => (
                      <label key={house.id} className="house-item">
                        <input
                          type="checkbox"
                          checked={selectedHouses.includes(house.id)}
                          onChange={() => toggleHouse(house.id)}
                        />
                        <span className="house-id">{house.house_id}</span>
                        {house.name && <span className="house-name">{house.name}</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="send-btn"
                  onClick={handleSend}
                  disabled={sending || selectedHouses.length === 0}
                >
                  {sending ? 'Sending...' : `Send to ${selectedHouses.length} House(s)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SendSurveyModal
