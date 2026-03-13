import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import NotificationButton from './NotificationButton'
import { useAuth } from '../contexts/AuthContext'
import { getSensorHistory, getTwinState, getMeterHistory, getApplianceHistory, getLatestPrediction, getWeatherHistory } from '../services/api'

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

const APPLIANCE_COLORS = {
  'TV': '#3b82f6',
  'Koelkast': '#10b981',
  'Wasmachine': '#f59e0b',
  'Droogkast': '#ef4444',
  'Diepvries': '#8b5cf6',
}

function formatTime(isoString) {
  const d = new Date(isoString)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Dashboard() {
  const { house } = useAuth()
  const houseId = house?.houseId
  const [sensorData, setSensorData] = useState(null)
  const [twinState, setTwinState] = useState(null)
  const [meterData, setMeterData] = useState(null)
  const [applianceData, setApplianceData] = useState(null)
  const [predictionData, setPredictionData] = useState(null)
  const [weatherData, setWeatherData] = useState(null)
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
        const [history, state, meterHist, applianceHist, prediction, weatherHist] = await Promise.all([
          getSensorHistory(houseId, 24),
          getTwinState(houseId),
          getMeterHistory(houseId, 24).catch(() => null),
          getApplianceHistory(houseId, 24).catch(() => null),
          getLatestPrediction(houseId).catch(() => null),
          getWeatherHistory(houseId, 24).catch(() => null),
        ])
        if (!cancelled) {
          setSensorData(history)
          setTwinState(state)
          setMeterData(meterHist)
          setApplianceData(applianceHist)
          setPredictionData(prediction)
          setWeatherData(weatherHist)
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
    const interval = setInterval(fetchData, 5 * 60 * 1000) // refresh every 5 min
    return () => { cancelled = true; clearInterval(interval) }
  }, [houseId])

  // Compute widgets from latest twin state + meter data
  const widgets = useMemo(() => {
    if (!twinState?.rooms?.length) return null
    const rooms = twinState.rooms
    const roomsWithTemp = rooms.filter(r => r.temperature != null)
    const avgTemp = roomsWithTemp.length > 0
      ? (roomsWithTemp.reduce((s, r) => s + parseFloat(r.temperature), 0) / roomsWithTemp.length).toFixed(1)
      : '--'
    const motionRooms = rooms.filter(r => parseInt(r.pir) > 0).length
    const setpoint = rooms[0]?.temperature_set != null ? parseFloat(rooms[0].temperature_set).toFixed(1) : '--'

    const outsideTemp = twinState.weather?.temperature != null
      ? parseFloat(twinState.weather.temperature).toFixed(1)
      : null

    const items = [
      { label: 'Avg Temperature', value: `${avgTemp} °C`, color: 'green' },
      ...(outsideTemp != null ? [{ label: 'Outside Temp', value: `${outsideTemp} °C`, color: 'cyan' }] : []),
      { label: 'Motion Detected', value: `${motionRooms} room${motionRooms !== 1 ? 's' : ''}`, color: 'blue' },
      { label: 'Setpoint', value: `${setpoint} °C`, color: 'yellow' },
      { label: 'Rooms Monitored', value: `${rooms.length}`, color: 'red' },
    ]

    // Add power draw widget if meter data available
    if (meterData?.data?.length > 0) {
      const latest = meterData.data[meterData.data.length - 1]
      if (latest.positive_active_power != null) {
        items.push({ label: 'Power Draw', value: `${Math.round(latest.positive_active_power)} W`, color: 'blue' })
      }
      if (latest.gas_kuub != null) {
        items.push({ label: 'Gas Meter', value: `${latest.gas_kuub.toFixed(2)} m³`, color: 'yellow' })
      }
    }

    return items
  }, [twinState, meterData])

  // Parse prediction data into chart-ready format
  const predictionPoints = useMemo(() => {
    if (!predictionData?.prediction?.rooms) return { data: [], rooms: [] }
    const baseTime = new Date(predictionData.predicted_at)
    const rooms = predictionData.prediction.rooms
    const roomMap = {}
    for (const key of Object.keys(rooms)) {
      const afterHouse = key.split('__')[1] || key
      const displayName = afterHouse.replace(/_temperature$/, '').replace(/_/g, ' ')
      roomMap[displayName] = key
    }
    const offsets = new Set()
    for (const points of Object.values(rooms)) {
      for (const p of points) offsets.add(p.offset_min)
    }
    const sortedOffsets = [...offsets].sort((a, b) => a - b)
    const data = sortedOffsets.map(offset => {
      const t = new Date(baseTime.getTime() + offset * 60000)
      const point = { time: formatTime(t.toISOString()) }
      for (const [displayName, key] of Object.entries(roomMap)) {
        const match = rooms[key].find(p => p.offset_min === offset)
        if (match) point[`${displayName}_pred`] = match.temp
      }
      return point
    })
    return { data, rooms: Object.keys(roomMap) }
  }, [predictionData])

  // Build sorted weather readings for forward-fill lookup
  const weatherReadings = useMemo(() => {
    if (!weatherData?.data?.length) return []
    return weatherData.data
      .map(d => ({ time: new Date(d.recorded_at).getTime(), temp: parseFloat(d.temperature) }))
      .sort((a, b) => a.time - b.time)
  }, [weatherData])

  // Chart data: temperature by room (with prediction dashed lines + outside temp)
  const tempByRoomData = useMemo(() => {
    if (!sensorData?.data?.length) return []
    let wi = 0
    const actual = sensorData.data.map(d => {
      const time = formatTime(d.time)
      const point = { time }
      for (const room of sensorData.rooms) {
        point[room] = d[`${room}_temp`]
      }
      // Forward-fill: advance weather index to the last reading at or before this sensor time
      if (weatherReadings.length > 0) {
        const t = new Date(d.time).getTime()
        while (wi < weatherReadings.length - 1 && weatherReadings[wi + 1].time <= t) wi++
        if (weatherReadings[wi].time <= t) {
          point.outside = weatherReadings[wi].temp
        }
      }
      return point
    })
    if (!predictionPoints.data.length) return actual
    // Bridge last actual point so prediction line connects
    const lastActual = actual[actual.length - 1]
    if (lastActual) {
      for (const room of predictionPoints.rooms) {
        const sensorRoom = sensorData.rooms.find(r => r === room)
        if (sensorRoom && lastActual[sensorRoom] != null) {
          lastActual[`${room}_pred`] = lastActual[sensorRoom]
        }
      }
    }
    return [...actual, ...predictionPoints.data]
  }, [sensorData, predictionPoints, weatherReadings])

  // Chart data: temp vs setpoint for selected room (with prediction)
  const tempVsSetpointData = useMemo(() => {
    if (!sensorData?.data?.length || !selectedRoom) return []
    const actual = sensorData.data.map(d => ({
      time: formatTime(d.time),
      temperature: d[`${selectedRoom}_temp`],
      setpoint: d[`${selectedRoom}_set`],
    }))
    if (predictionPoints.rooms.includes(selectedRoom) && predictionPoints.data.length) {
      const lastActual = actual[actual.length - 1]
      if (lastActual && lastActual.temperature != null) {
        lastActual.temp_pred = lastActual.temperature
      }
      for (const p of predictionPoints.data) {
        actual.push({ time: p.time, temp_pred: p[`${selectedRoom}_pred`] })
      }
    }
    return actual
  }, [sensorData, selectedRoom, predictionPoints])

  // Chart data: motion (PIR) per room
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

  // Humidity & CO2 data (only rooms that have data)
  const { humidityData, humidityRooms } = useMemo(() => {
    if (!sensorData?.data?.length) return { humidityData: [], humidityRooms: [] }
    const hRooms = sensorData.rooms.filter(r =>
      sensorData.data.some(d => d[`${r}_humidity`] != null || d[`${r}_co2`] != null)
    )
    if (hRooms.length === 0) return { humidityData: [], humidityRooms: [] }
    const data = sensorData.data.map(d => {
      const point = { time: formatTime(d.time) }
      for (const room of hRooms) {
        point[`${room} humidity`] = d[`${room}_humidity`]
        point[`${room} CO2`] = d[`${room}_co2`]
      }
      return point
    })
    return { humidityData: data, humidityRooms: hRooms }
  }, [sensorData])

  // Electricity chart data
  const electricityData = useMemo(() => {
    if (!meterData?.data?.length) return []
    return meterData.data.map(d => ({
      time: formatTime(d.time),
      draw: d.positive_active_power,
      return: d.negative_active_power,
    }))
  }, [meterData])

  // Gas chart data (consumption per interval, not cumulative)
  const gasData = useMemo(() => {
    if (!meterData?.data?.length) return []
    return meterData.data
      .filter(d => d.gas_usage != null)
      .map(d => ({
        time: formatTime(d.time),
        gas: d.gas_usage,
      }))
  }, [meterData])

  // Appliance chart data
  const { applianceChartData, applianceNames } = useMemo(() => {
    if (!applianceData?.data?.length) return { applianceChartData: [], applianceNames: [] }
    return {
      applianceChartData: applianceData.data.map(d => ({
        time: formatTime(d.time),
        ...d,
      })),
      applianceNames: applianceData.appliances || [],
    }
  }, [applianceData])

  if (loading) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <h1>MAIHomeCenter</h1>
          <p>{house?.name || 'Dashboard'}</p>
        </header>
        <div className="loading-message">Loading sensor data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <h1>MAIHomeCenter</h1>
          <p>{house?.name || 'Dashboard'}</p>
        </header>
        <div className="error-message">Failed to load data: {error}</div>
      </div>
    )
  }

  const hasData = sensorData?.data?.length > 0

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>MAIHomeCenter</h1>
        <p>{house?.name || 'Dashboard'}</p>
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
                  {predictionPoints.rooms.map(room => {
                    const idx = sensorData.rooms.indexOf(room)
                    if (idx === -1) return null
                    return <Line key={`${room}_pred`} type="monotone" dataKey={`${room}_pred`} stroke={ROOM_COLORS[idx % ROOM_COLORS.length]} strokeWidth={1.5} dot={false} strokeDasharray="6 4" name={`${room} (pred)`} />
                  })}
                  {weatherData?.data?.length > 0 && (
                    <Line type="monotone" dataKey="outside" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="8 4" name="Outside" />
                  )}
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
                  {predictionPoints.rooms.includes(selectedRoom) && (
                    <Line type="monotone" dataKey="temp_pred" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="6 4" name="Predicted °C" />
                  )}
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

            {/* Humidity & CO2 (conditional) */}
            {humidityRooms.length > 0 && (
              <div className="chart-card">
                <h3>Humidity & CO2 (24h)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={humidityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 10, angle: -90, textAnchor: 'end' }} interval="preserveStartEnd" height={50} />
                    <YAxis yAxisId="humidity" tick={{ fill: '#a0aec0', fontSize: 11 }} unit="%" />
                    <YAxis yAxisId="co2" orientation="right" tick={{ fill: '#a0aec0', fontSize: 11 }} unit=" ppm" />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                    {humidityRooms.map((room, i) => (
                      <Line key={`${room}-h`} yAxisId="humidity" type="monotone" dataKey={`${room} humidity`} stroke={ROOM_COLORS[i % ROOM_COLORS.length]} strokeWidth={2} dot={false} />
                    ))}
                    {humidityRooms.map((room, i) => (
                      <Line key={`${room}-c`} yAxisId="co2" type="monotone" dataKey={`${room} CO2`} stroke={ROOM_COLORS[i % ROOM_COLORS.length]} strokeWidth={1} dot={false} strokeDasharray="5 5" />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Electricity (conditional) */}
            {electricityData.length > 0 && (
              <div className="chart-card">
                <h3>Electricity (24h)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={electricityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 10, angle: -90, textAnchor: 'end' }} interval="preserveStartEnd" height={50} />
                    <YAxis tick={{ fill: '#a0aec0', fontSize: 11 }} unit=" W" />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                    <Line type="monotone" dataKey="draw" stroke="#f59e0b" strokeWidth={2} dot={false} name="Draw (W)" />
                    <Line type="monotone" dataKey="return" stroke="#10b981" strokeWidth={2} dot={false} name="Return (W)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Gas (conditional) */}
            {gasData.length > 0 && (
              <div className="chart-card">
                <h3>Gas Usage (24h)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={gasData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 10, angle: -90, textAnchor: 'end' }} interval="preserveStartEnd" height={50} />
                    <YAxis tick={{ fill: '#a0aec0', fontSize: 11 }} unit=" m³" />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                    <Line type="monotone" dataKey="gas" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Usage (m³)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Appliance Power (conditional) */}
            {applianceNames.length > 0 && (
              <div className="chart-card">
                <h3>Appliance Power (24h)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={applianceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 10, angle: -90, textAnchor: 'end' }} interval="preserveStartEnd" height={50} />
                    <YAxis tick={{ fill: '#a0aec0', fontSize: 11 }} unit=" W" />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                    {applianceNames.map((name, i) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={APPLIANCE_COLORS[name] || ROOM_COLORS[i % ROOM_COLORS.length]} strokeWidth={2} dot={false} name={name} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}

      <div className="notification-section">
        <h2>Notifications</h2>
        <NotificationButton />
      </div>
    </div>
  )
}

export default Dashboard
