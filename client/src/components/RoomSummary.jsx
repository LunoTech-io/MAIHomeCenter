import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { getTwinState } from '../services/api'

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

function getSensorNoteKey(value, key) {
  if (value == null) return null
  if (key === 'temperature') {
    if (value < 17) return 'comfort.tooCold'
    if (value < 19) return 'comfort.aBitCool'
    if (value <= 23) return null
    if (value <= 26) return 'comfort.aBitWarm'
    return 'comfort.tooHot'
  }
  if (key === 'humidity') {
    if (value < 30) return 'comfort.veryDry'
    if (value < 40) return 'comfort.aBitDry'
    if (value <= 60) return null
    if (value <= 70) return 'comfort.aBitHumid'
    return 'comfort.veryHumid'
  }
  if (key === 'co2') {
    if (value <= 800) return null
    if (value <= 1200) return 'comfort.airFresher'
    return 'comfort.ventilate'
  }
  return null
}

const FACES = [
  { emoji: '\u{1F60A}', labelKey: 'comfort.great' },
  { emoji: '\u{1F642}', labelKey: 'comfort.great' },
  { emoji: '\u{1F610}', labelKey: 'comfort.great' },
  { emoji: '\u{1F615}', labelKey: 'comfort.great' },
  { emoji: '\u{1F61F}', labelKey: 'comfort.great' },
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

  if (scores.length === 0) return { score: null, faceIndex: 2, noteKeys: ['comfort.noData'] }

  const worstScore = Math.max(...scores)
  const faceIndex = Math.min(worstScore, 4)

  const noteKeys = [
    getSensorNoteKey(temp, 'temperature'),
    getSensorNoteKey(humidity, 'humidity'),
    getSensorNoteKey(co2, 'co2'),
  ].filter(Boolean)

  if (noteKeys.length === 0) noteKeys.push('comfort.great')

  return { score: worstScore, faceIndex, noteKeys }
}

function RoomSummary() {
  const { house } = useAuth()
  const { t } = useLanguage()
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

  const faces = ['\u{1F60A}', '\u{1F642}', '\u{1F610}', '\u{1F615}', '\u{1F61F}']

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>{t('dashboard.title')}</h1>
        <p>{house?.name || t('summary.title')}</p>
        <div className="view-toggle-links">
          <Link to="/" className="view-toggle-link">{t('dashboard.charts')}</Link>
          <Link to="/status" className="view-toggle-link">{t('dashboard.gauges')}</Link>
        </div>
      </header>

      {loading && <div className="loading">{t('common.loading')}</div>}
      {error && <div className="error-message" role="alert">{t('common.failedToLoad')}: {error}</div>}

      {!loading && !error && twinState?.rooms?.length > 0 && (
        <>
          {outsideTemp != null && (
            <div className="summary-outside">
              {t('summary.outsideTemp')}: {outsideTemp} °C
            </div>
          )}
          <div className="summary-table" role="table" aria-label={t('summary.title')}>
            <div className="summary-header" role="row">
              <span role="columnheader">{t('summary.room')}</span>
              <span role="columnheader">{t('summary.status')}</span>
              <span role="columnheader">{t('summary.details')}</span>
            </div>
            {twinState.rooms.map(room => {
              const { faceIndex, noteKeys } = getRoomStatus(room)
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
                  <div className="summary-face" role="cell" aria-label={t(noteKeys[0])}>
                    <span className="face-emoji">{faces[faceIndex]}</span>
                  </div>
                  <div className="summary-notes" role="cell">
                    {noteKeys.map((key, i) => (
                      <span key={i} className="summary-note">{t(key)}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {!loading && !error && (!twinState?.rooms?.length) && (
        <div className="empty-message">{t('summary.noData')}</div>
      )}
    </div>
  )
}

export default RoomSummary
