import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getTwinState } from '../services/api'

// Returns a score 0-4: 0=great, 1=good, 2=fair, 3=poor, 4=bad
function getSensorScore(value, key) {
  if (value == null) return null
  if (key === 'temperature') {
    if (value >= 19 && value <= 23) return 0
    if (value >= 17 && value <= 26) return 2
    return 4
  }
  if (key === 'humidity') {
    if (value >= 40 && value <= 60) return 0
    if (value >= 30 && value <= 70) return 2
    return 4
  }
  if (key === 'co2') {
    if (value <= 800) return 0
    if (value <= 1200) return 2
    return 4
  }
  return null
}

function getSensorNote(value, key) {
  if (value == null) return null
  if (key === 'temperature') {
    if (value < 17) return 'Too cold'
    if (value < 19) return 'A bit cool'
    if (value <= 23) return null
    if (value <= 26) return 'A bit warm'
    return 'Too hot'
  }
  if (key === 'humidity') {
    if (value < 30) return 'Very dry'
    if (value < 40) return 'A bit dry'
    if (value <= 60) return null
    if (value <= 70) return 'A bit humid'
    return 'Very humid'
  }
  if (key === 'co2') {
    if (value <= 800) return null
    if (value <= 1200) return 'Air could be fresher'
    return 'Ventilate the room'
  }
  return null
}

const FACES = [
  { emoji: '\u{1F60A}', label: 'Great' },
  { emoji: '\u{1F642}', label: 'Good' },
  { emoji: '\u{1F610}', label: 'Fair' },
  { emoji: '\u{1F615}', label: 'Not ideal' },
  { emoji: '\u{1F61F}', label: 'Needs attention' },
]

function getRoomStatus(room) {
  const temp = room.temperature != null ? parseFloat(room.temperature) : null
  const humidity = room.humidity != null ? parseFloat(room.humidity) : null
  const co2 = room.co2 != null ? parseFloat(room.co2) : null

  const scores = [
    getSensorScore(temp, 'temperature'),
    getSensorScore(humidity, 'humidity'),
    getSensorScore(co2, 'co2'),
  ].filter(s => s != null)

  if (scores.length === 0) return { score: null, face: FACES[2], notes: ['No sensor data'] }

  const worstScore = Math.max(...scores)
  const face = FACES[Math.min(worstScore, 4)]

  const notes = [
    getSensorNote(temp, 'temperature'),
    getSensorNote(humidity, 'humidity'),
    getSensorNote(co2, 'co2'),
  ].filter(Boolean)

  if (notes.length === 0) notes.push('Everything looks good')

  return { score: worstScore, face, notes }
}

function RoomSummary() {
  const { house } = useAuth()
  const houseId = house?.houseId
  const [twinState, setTwinState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!houseId) return
    let cancelled = false

    async function fetchData() {
      try {
        const state = await getTwinState(houseId)
        if (!cancelled) {
          setTwinState(state)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [houseId])

  const outsideTemp = twinState?.weather?.temperature != null
    ? parseFloat(twinState.weather.temperature).toFixed(1)
    : null

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>MAIHomeCenter</h1>
        <p>{house?.name || 'Room Summary'}</p>
        <div className="view-toggle-links">
          <Link to="/" className="view-toggle-link">Charts</Link>
          <Link to="/status" className="view-toggle-link">Gauges</Link>
        </div>
      </header>

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error-message" role="alert">Failed to load data: {error}</div>}

      {!loading && !error && twinState?.rooms?.length > 0 && (
        <>
          {outsideTemp != null && (
            <div className="summary-outside">
              Outside temperature: {outsideTemp} °C
            </div>
          )}
          <div className="summary-table" role="table" aria-label="Room status summary">
            <div className="summary-header" role="row">
              <span role="columnheader">Room</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Details</span>
            </div>
            {twinState.rooms.map(room => {
              const { face, notes } = getRoomStatus(room)
              const temp = room.temperature != null ? parseFloat(room.temperature).toFixed(1) : null
              const humidity = room.humidity != null ? parseFloat(room.humidity).toFixed(0) : null
              const co2 = room.co2 != null ? parseFloat(room.co2).toFixed(0) : null

              return (
                <div key={room.room_name} className="summary-row" role="row">
                  <div className="summary-room" role="cell">
                    <span className="summary-room-name">{room.room_name}</span>
                    <span className="summary-readings">
                      {temp != null && <span>{temp}°C</span>}
                      {humidity != null && <span>{humidity}%</span>}
                      {co2 != null && <span>{co2} ppm</span>}
                    </span>
                  </div>
                  <div className="summary-face" role="cell" aria-label={face.label}>
                    <span className="face-emoji">{face.emoji}</span>
                  </div>
                  <div className="summary-notes" role="cell">
                    {notes.map((note, i) => (
                      <span key={i} className="summary-note">{note}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {!loading && !error && (!twinState?.rooms?.length) && (
        <div className="empty-message">No sensor data available yet.</div>
      )}
    </div>
  )
}

export default RoomSummary
