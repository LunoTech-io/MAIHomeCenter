import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { getSensorHistory, getTwinState } from '../../services/api'

const chartTooltipStyle = {
  backgroundColor: '#16213e',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#fff'
}

const ROOM_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
]

function formatTime(isoString) {
  const d = new Date(isoString)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function HouseDashboard() {
  const { houseId } = useParams()
  const navigate = useNavigate()
  const [sensorData, setSensorData] = useState(null)
  const [twinState, setTwinState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedRoom, setSelectedRoom] = useState(null)

  useEffect(() => {
    if (!houseId) return

    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [history, state] = await Promise.all([
          getSensorHistory(houseId, 24),
          getTwinState(houseId)
        ])
        if (!cancelled) {
          setSensorData(history)
          setTwinState(state)
          if (history.rooms?.length > 0 && !selectedRoom) {
            setSelectedRoom(history.rooms[0])
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [houseId])

  const widgets = useMemo(() => {
    if (!twinState?.rooms?.length) return null
    const rooms = twinState.rooms
    const avgTemp = (rooms.reduce((s, r) => s + (parseFloat(r.temperature) || 0), 0) / rooms.length).toFixed(1)
    const motionRooms = rooms.filter(r => parseInt(r.pir) > 0).length
    const setpoint = rooms[0]?.temperature_set != null ? parseFloat(rooms[0].temperature_set).toFixed(1) : '--'
    return [
      { label: 'Avg Temperature', value: `${avgTemp} °C`, color: 'green' },
      { label: 'Motion Detected', value: `${motionRooms} room${motionRooms !== 1 ? 's' : ''}`, color: 'blue' },
      { label: 'Setpoint', value: `${setpoint} °C`, color: 'yellow' },
      { label: 'Rooms Monitored', value: `${rooms.length}`, color: 'red' },
    ]
  }, [twinState])

  const tempByRoomData = useMemo(() => {
    if (!sensorData?.data?.length) return []
    return sensorData.data.map(d => {
      const point = { time: formatTime(d.time) }
      for (const room of sensorData.rooms) {
        point[room] = d[`${room}_temp`]
      }
      return point
    })
  }, [sensorData])

  const tempVsSetpointData = useMemo(() => {
    if (!sensorData?.data?.length || !selectedRoom) return []
    return sensorData.data.map(d => ({
      time: formatTime(d.time),
      temperature: d[`${selectedRoom}_temp`],
      setpoint: d[`${selectedRoom}_set`],
    }))
  }, [sensorData, selectedRoom])

  const motionData = useMemo(() => {
    if (!sensorData?.data?.length) return []
    return sensorData.data.map(d => {
      const point = { time: formatTime(d.time) }
      for (const room of sensorData.rooms) {
        point[room] = d[`${room}_pir`]
      }
      return point
    })
  }, [sensorData])

  if (loading) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <button className="back-btn" onClick={() => navigate('/houses')}>
            ← Back to Houses
          </button>
          <h1>{houseId}</h1>
        </header>
        <div className="loading-message">Loading sensor data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <button className="back-btn" onClick={() => navigate('/houses')}>
            ← Back to Houses
          </button>
          <h1>{houseId}</h1>
        </header>
        <div className="error-message">Failed to load data: {error}</div>
      </div>
    )
  }

  const hasData = sensorData?.data?.length > 0

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <button className="back-btn" onClick={() => navigate('/houses')}>
          ← Back to Houses
        </button>
        <h1>{houseId}</h1>
      </header>

      {!hasData ? (
        <div className="empty-message">No sensor data available yet. Data will appear once sensors start reporting.</div>
      ) : (
        <>
          {widgets && (
            <div className="widget-grid">
              {widgets.map((widget, index) => (
                <div key={index} className="widget">
                  <div className={`widget-value ${widget.color}`}>{widget.value}</div>
                  <div className="widget-label">{widget.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="chart-section">
            {/* Temperature by Room */}
            <div className="chart-card">
              <h3>Temperature by Room (24h)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={tempByRoomData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 10, angle: -90, textAnchor: 'end' }} interval="preserveStartEnd" height={50} />
                  <YAxis tick={{ fill: '#a0aec0', fontSize: 11 }} domain={['dataMin - 1', 'dataMax + 1']} unit="°C" />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  {sensorData.rooms.map((room, i) => (
                    <Line key={room} type="monotone" dataKey={room} stroke={ROOM_COLORS[i % ROOM_COLORS.length]} strokeWidth={2} dot={false} name={room} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Temperature vs Setpoint */}
            <div className="chart-card">
              <h3>
                Temperature vs Setpoint
                {sensorData.rooms.length > 1 && (
                  <select
                    value={selectedRoom || ''}
                    onChange={e => setSelectedRoom(e.target.value)}
                    style={{ marginLeft: 12, fontSize: 13, padding: '2px 8px', background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4 }}
                  >
                    {sensorData.rooms.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                )}
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={tempVsSetpointData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 10, angle: -90, textAnchor: 'end' }} interval="preserveStartEnd" height={50} />
                  <YAxis tick={{ fill: '#a0aec0', fontSize: 11 }} domain={['dataMin - 1', 'dataMax + 1']} unit="°C" />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="temperature" stroke="#10b981" strokeWidth={2} dot={false} name="Actual °C" />
                  <Line type="monotone" dataKey="setpoint" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Setpoint °C" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Motion Activity */}
            <div className="chart-card">
              <h3>Motion Activity (24h)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={motionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 10, angle: -90, textAnchor: 'end' }} interval="preserveStartEnd" height={50} />
                  <YAxis tick={{ fill: '#a0aec0', fontSize: 11 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  {sensorData.rooms.map((room, i) => (
                    <Bar key={room} dataKey={room} fill={ROOM_COLORS[i % ROOM_COLORS.length]} opacity={0.7} name={room} stackId="pir" />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default HouseDashboard
