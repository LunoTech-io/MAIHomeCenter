import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { getTwinState, getComfortThresholds } from '../services/api'
import { getRoomType, getEffectiveThresholds, normalizeThresholds } from '../utils/roomTypes'

const DEFAULTS = {
  temperature: { tooCold: 17, cool: 19, warm: 23, tooHot: 26 },
  humidity: { veryDry: 30, dry: 40, humid: 60, veryHumid: 70 },
  co2: { fair: 800, poor: 1200 },
}

function getSensorScore(value, key, th) {
  if (value == null) return null
  if (key === 'temperature') {
    if (value >= th.temperature.cool && value <= th.temperature.warm) return 0
    if (value >= th.temperature.tooCold && value <= th.temperature.tooHot) return 2
    return 4
  }
  if (key === 'humidity') {
    if (value >= th.humidity.dry && value <= th.humidity.humid) return 0
    if (value >= th.humidity.veryDry && value <= th.humidity.veryHumid) return 2
    return 4
  }
  if (key === 'co2') {
    if (value <= th.co2.fair) return 0
    if (value <= th.co2.poor) return 2
    return 4
  }
  return null
}

function getSensorNoteKey(value, key, th) {
  if (value == null) return null
  if (key === 'temperature') {
    if (value < th.temperature.tooCold) return 'comfort.tooCold'
    if (value < th.temperature.cool) return 'comfort.aBitCool'
    if (value <= th.temperature.warm) return null
    if (value <= th.temperature.tooHot) return 'comfort.aBitWarm'
    return 'comfort.tooHot'
  }
  if (key === 'humidity') {
    if (value < th.humidity.veryDry) return 'comfort.veryDry'
    if (value < th.humidity.dry) return 'comfort.aBitDry'
    if (value <= th.humidity.humid) return null
    if (value <= th.humidity.veryHumid) return 'comfort.aBitHumid'
    return 'comfort.veryHumid'
  }
  if (key === 'co2') {
    if (value <= th.co2.fair) return null
    if (value <= th.co2.poor) return 'comfort.airFresher'
    return 'comfort.ventilate'
  }
  return null
}

function getRoomStatus(room, th) {
  const temp = room.temperature != null ? parseFloat(room.temperature) : null
  const humidity = room.humidity != null ? parseFloat(room.humidity) : null
  const co2 = room.co2 != null ? parseFloat(room.co2) : null

  const scores = [
    getSensorScore(temp, 'temperature', th),
    getSensorScore(humidity, 'humidity', th),
    getSensorScore(co2, 'co2', th),
  ].filter(s => s != null)

  if (scores.length === 0) return { score: null, faceIndex: 2, noteKeys: ['comfort.noData'] }

  const worstScore = Math.max(...scores)
  const faceIndex = Math.min(worstScore, 4)

  const noteKeys = [
    getSensorNoteKey(temp, 'temperature', th),
    getSensorNoteKey(humidity, 'humidity', th),
    getSensorNoteKey(co2, 'co2', th),
  ].filter(Boolean)

  if (noteKeys.length === 0) noteKeys.push('comfort.great')

  return { score: worstScore, faceIndex, noteKeys }
}

function RoomSummary() {
  const { house } = useAuth()
  const { t, tRoom } = useLanguage()
  const houseId = house?.houseId
  const [twinState, setTwinState] = useState(null)
  const [thresholds, setThresholds] = useState({ default: DEFAULTS })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!houseId) return
    let cancelled = false

    async function fetchData() {
      try {
        const [state, th] = await Promise.all([
          getTwinState(houseId),
          getComfortThresholds().catch(() => null),
        ])
        if (!cancelled) {
          setTwinState(state)
          const normalized = normalizeThresholds(th)
          if (normalized) {
            const serverDefaults = normalized.default || {}
            setThresholds({
              ...normalized,
              default: {
                temperature: { ...DEFAULTS.temperature, ...(serverDefaults.temperature || {}) },
                humidity:    { ...DEFAULTS.humidity,    ...(serverDefaults.humidity    || {}) },
                co2:         { ...DEFAULTS.co2,         ...(serverDefaults.co2         || {}) },
              },
            })
          }
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

  // hide rooms without any sensor readings
  const roomsWithData = (twinState?.rooms || []).filter(room =>
    room.temperature != null || room.humidity != null || room.co2 != null
  )

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>{t('dashboard.title')}</h1>
        <p>{house?.name || t('summary.title')}</p>
        <div className="view-toggle-links">
          <Link to="/charts" className="view-toggle-link">{t('dashboard.charts')}</Link>
        </div>
      </header>

      {loading && <div className="loading">{t('common.loading')}</div>}
      {error && <div className="error-message" role="alert">{t('common.failedToLoad')}: {error}</div>}

      {!loading && !error && roomsWithData.length > 0 && (
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
            {roomsWithData.map(room => {
              const effective = getEffectiveThresholds(thresholds, getRoomType(room.room_name))
              const { faceIndex, noteKeys } = getRoomStatus(room, effective)
              const temp = room.temperature != null ? parseFloat(room.temperature).toFixed(1) : null
              const humidity = room.humidity != null ? parseFloat(room.humidity).toFixed(0) : null
              const co2 = room.co2 != null ? parseFloat(room.co2).toFixed(0) : null

              return (
                <div key={room.room_name} className="summary-row" role="row">
                  <div className="summary-room" role="cell">
                    <span className="summary-room-name">{tRoom(room.room_name)}</span>
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

      {!loading && !error && roomsWithData.length === 0 && (
        <div className="empty-message">{t('summary.noData')}</div>
      )}
    </div>
  )
}

export default RoomSummary
