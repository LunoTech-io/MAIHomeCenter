import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import GaugeComponent from 'react-gauge-component'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { getTwinState } from '../services/api'

const GAUGE_CONFIGS = {
  temperature: {
    min: 12, max: 32, unit: '°C', label: 'Temperature',
    subArcs: [
      { limit: 17, color: '#ef4444', showTick: true },
      { limit: 19, color: '#f59e0b', showTick: true },
      { limit: 23, color: '#10b981', showTick: true },
      { limit: 26, color: '#f59e0b', showTick: true },
      { color: '#ef4444' },
    ],
  },
  humidity: {
    min: 10, max: 90, unit: '%', label: 'Humidity',
    subArcs: [
      { limit: 30, color: '#ef4444', showTick: true },
      { limit: 40, color: '#f59e0b', showTick: true },
      { limit: 60, color: '#10b981', showTick: true },
      { limit: 70, color: '#f59e0b', showTick: true },
      { color: '#ef4444' },
    ],
  },
  co2: {
    min: 300, max: 2000, unit: 'ppm', label: 'CO2',
    subArcs: [
      { limit: 800, color: '#10b981', showTick: true },
      { limit: 1200, color: '#f59e0b', showTick: true },
      { color: '#ef4444' },
    ],
  },
}

function getZoneColor(value, key) {
  if (value == null) return null
  const cfg = GAUGE_CONFIGS[key]
  if (key === 'co2') {
    if (value <= 800) return '#10b981'
    if (value <= 1200) return '#f59e0b'
    return '#ef4444'
  }
  const arcs = cfg.subArcs
  if (value < arcs[0].limit) return arcs[0].color
  if (value < arcs[1].limit) return arcs[1].color
  if (value <= arcs[2].limit) return arcs[2].color
  if (value <= arcs[3].limit) return arcs[3].color
  return arcs[4].color
}

function SensorGauge({ value, configKey, size = 120 }) {
  const cfg = GAUGE_CONFIGS[configKey]
  if (value == null) return <div className="gauge-na">--</div>

  return (
    <div className="sensor-gauge" style={{ width: size }}>
      <GaugeComponent
        type="grafana"
        value={value}
        minValue={cfg.min}
        maxValue={cfg.max}
        arc={{
          subArcs: cfg.subArcs,
          padding: 0.02,
          width: 0.2,
        }}
        pointer={{
          type: 'needle',
          elastic: true,
          animationDelay: 0,
        }}
        labels={{
          valueLabel: {
            matchColorWithArc: true,
            formatTextValue: v => `${v}${cfg.unit}`,
            style: { fontSize: 28, textShadow: 'none' },
          },
          tickLabels: {
            type: 'outer',
            defaultTickValueConfig: {
              style: { fontSize: 10, fill: 'var(--text-secondary)' },
            },
            defaultTickLineConfig: {
              color: 'var(--border-subtle)',
            },
          },
        }}
        style={{ width: '100%' }}
      />
    </div>
  )
}

function RoomCard({ room }) {
  const { tRoom } = useLanguage()
  const temp = room.temperature != null ? parseFloat(room.temperature) : null
  const humidity = room.humidity != null ? parseFloat(room.humidity) : null
  const co2 = room.co2 != null ? parseFloat(room.co2) : null
  const hasMotion = parseInt(room.pir) > 0

  const colors = [
    getZoneColor(temp, 'temperature'),
    getZoneColor(humidity, 'humidity'),
    getZoneColor(co2, 'co2'),
  ].filter(Boolean)

  let statusColor = '#10b981'
  if (colors.includes('#ef4444')) statusColor = '#ef4444'
  else if (colors.includes('#f59e0b')) statusColor = '#f59e0b'

  return (
    <div className="room-gauge-card">
      <div className="room-gauge-header">
        <div className="room-status-dot" style={{ background: statusColor }} />
        <h3 className="room-gauge-name">{tRoom(room.room_name)}</h3>
        {hasMotion && <span className="room-motion-badge">Motion</span>}
      </div>

      <div className="sensor-gauge-row">
        {temp != null && (
          <div className="sensor-gauge-item">
            <SensorGauge value={temp} configKey="temperature" />
            <span className="sensor-gauge-label">{GAUGE_CONFIGS.temperature.label}</span>
          </div>
        )}
        {humidity != null && (
          <div className="sensor-gauge-item">
            <SensorGauge value={humidity} configKey="humidity" />
            <span className="sensor-gauge-label">{GAUGE_CONFIGS.humidity.label}</span>
          </div>
        )}
        {co2 != null && (
          <div className="sensor-gauge-item">
            <SensorGauge value={co2} configKey="co2" />
            <span className="sensor-gauge-label">{GAUGE_CONFIGS.co2.label}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function GaugeDashboard() {
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
    ? parseFloat(twinState.weather.temperature)
    : null

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>{t('dashboard.title')}</h1>
        <p>{house?.name || t('gauge.roomStatus')}</p>
        <div className="view-toggle-links">
          <Link to="/" className="view-toggle-link">{t('dashboard.charts')}</Link>
          <Link to="/summary" className="view-toggle-link">{t('dashboard.summary')}</Link>
        </div>
      </header>

      {loading && <div className="loading-message">{t('common.loading')}</div>}
      {error && <div className="error-message">{t('common.failedToLoad')}: {error}</div>}

      {!loading && !error && twinState?.rooms?.length > 0 && (
        <>
          {outsideTemp != null && (
            <div className="outside-temp-gauge">
              <span className="outside-temp-label">{t('gauge.outside')}</span>
              <SensorGauge value={outsideTemp} configKey="temperature" size={100} />
            </div>
          )}
          <div className="room-gauge-grid">
            {twinState.rooms.map(room => (
              <RoomCard key={room.room_name} room={room} />
            ))}
          </div>
        </>
      )}

      {!loading && !error && (!twinState?.rooms?.length) && (
        <div className="empty-message">{t('summary.noData')}</div>
      )}
    </div>
  )
}

export default GaugeDashboard
