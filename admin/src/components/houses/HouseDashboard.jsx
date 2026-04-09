import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { getSensorHistory, getTwinState, getMeterHistory, getApplianceHistory, getLatestPrediction, getWeatherHistory, getHouses, getHouseAnalysis, generateHouseAnalysis } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'

const chartTooltipStyle = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  color: 'var(--text-primary)'
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

function getHalfHourTicks(data) {
  if (!data?.length) return { ticks: [], format: v => v }
  const timeSet = new Set()
  const entries = []
  for (const d of data) {
    if (timeSet.has(d.time)) continue
    timeSet.add(d.time)
    const [h, m] = d.time.split(':').map(Number)
    entries.push({ time: d.time, min: h * 60 + m })
  }
  // Collect all unique half-hour slots that have a nearby data point
  const ticks = []
  const labels = {}
  const used = new Set()
  for (let target = 0; target < 1440; target += 60) {
    let best = null, bestDist = Infinity
    for (const d of entries) {
      let dist = Math.abs(d.min - target)
      if (dist > 720) dist = 1440 - dist
      if (dist < bestDist) { bestDist = dist; best = d.time }
    }
    if (best && bestDist <= 30 && !used.has(best)) {
      used.add(best)
      labels[best] = `${String(Math.floor(target / 60) % 24).padStart(2, '0')}:00`
      ticks.push(best)
    }
  }
  // Sort ticks in the order they appear in the data
  const orderMap = {}
  data.forEach((d, i) => { if (!(d.time in orderMap)) orderMap[d.time] = i })
  ticks.sort((a, b) => orderMap[a] - orderMap[b])
  return { ticks, format: v => labels[v] || v }
}

function HouseDashboard() {
  const { houseId } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [sensorData, setSensorData] = useState(null)
  const [twinState, setTwinState] = useState(null)
  const [meterData, setMeterData] = useState(null)
  const [applianceData, setApplianceData] = useState(null)
  const [predictionData, setPredictionData] = useState(null)
  const [weatherData, setWeatherData] = useState(null)
  const [houseDetails, setHouseDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisLang, setAnalysisLang] = useState('en')

  useEffect(() => {
    if (!houseId) return

    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [history, state, meterHist, applianceHist, prediction, weatherHist, houses, savedAnalysis] = await Promise.all([
          getSensorHistory(houseId, 24),
          getTwinState(houseId),
          getMeterHistory(houseId, 24).catch(() => null),
          getApplianceHistory(houseId, 24).catch(() => null),
          getLatestPrediction(houseId).catch(() => null),
          getWeatherHistory(houseId, 24).catch(() => null),
          getHouses().catch(() => []),
          getHouseAnalysis(houseId).catch(() => null),
        ])
        if (!cancelled) {
          setSensorData(history)
          setTwinState(state)
          setMeterData(meterHist)
          setApplianceData(applianceHist)
          setPredictionData(prediction)
          setWeatherData(weatherHist)
          setHouseDetails(houses.find(h => h.house_id === houseId) || null)
          if (savedAnalysis) setAnalysis(savedAnalysis)
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
      { label: t('dashboard.avgTemperature'), value: `${avgTemp} °C`, color: 'green' },
      ...(outsideTemp != null ? [{ label: t('dashboard.outsideTemp'), value: `${outsideTemp} °C`, color: 'cyan' }] : []),
      { label: t('dashboard.motionDetected'), value: `${motionRooms} ${motionRooms !== 1 ? t('dashboard.rooms') : t('dashboard.room')}`, color: 'blue' },
      { label: t('dashboard.setpoint'), value: `${setpoint} °C`, color: 'yellow' },
      { label: t('dashboard.roomsMonitored'), value: `${rooms.length}`, color: 'red' },
    ]

    if (meterData?.data?.length > 0) {
      const latest = meterData.data[meterData.data.length - 1]
      if (latest.positive_active_power != null) {
        items.push({ label: t('dashboard.powerDraw'), value: `${Math.round(latest.positive_active_power)} W`, color: 'blue' })
      }
      if (latest.gas_kuub != null) {
        items.push({ label: t('dashboard.gasMeter'), value: `${latest.gas_kuub.toFixed(2)} m³`, color: 'yellow' })
      }
    }

    return items
  }, [twinState, meterData, t])

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
      const ts = new Date(baseTime.getTime() + offset * 60000)
      const point = { time: formatTime(ts.toISOString()) }
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
        const ts = new Date(d.time).getTime()
        while (wi < weatherReadings.length - 1 && weatherReadings[wi + 1].time <= ts) wi++
        if (weatherReadings[wi].time <= ts) {
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

  const electricityData = useMemo(() => {
    if (!meterData?.data?.length) return []
    return meterData.data.map(d => ({
      time: formatTime(d.time),
      draw: d.positive_active_power,
      return: d.negative_active_power,
    }))
  }, [meterData])

  // Find the nearest data point time to a target HH:MM string
  const findNearestTime = (data, target) => {
    if (!target || !data.length) return null
    const [th, tm] = target.split(':').map(Number)
    const targetMin = th * 60 + tm
    let best = null, bestDist = Infinity
    for (const d of data) {
      const [dh, dm] = d.time.split(':').map(Number)
      const dist = Math.abs(dh * 60 + dm - targetMin)
      if (dist < bestDist) { bestDist = dist; best = d.time }
    }
    return bestDist <= 15 ? best : null
  }

  // Get today's tariff from schedule
  const todayTariff = useMemo(() => {
    const sched = houseDetails?.tariff_schedule
    if (!sched) return null
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]
    return sched[dayKey] || null
  }, [houseDetails?.tariff_schedule])

  const tariffHighX = findNearestTime(electricityData, todayTariff?.high || null)
  const tariffLowX = findNearestTime(electricityData, todayTariff?.low || null)

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

  const { applianceChartData, applianceNames } = useMemo(() => {
    if (!applianceData?.data?.length) return { applianceChartData: [], applianceNames: [] }
    return {
      applianceChartData: applianceData.data.map(d => ({
        ...d,
        time: formatTime(d.time),
      })),
      applianceNames: applianceData.appliances || [],
    }
  }, [applianceData])

  if (loading) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <button className="back-btn" onClick={() => navigate('/houses')}>
            ← {t('dashboard.backToHouses')}
          </button>
          <h1>{houseId}</h1>
        </header>
        <div className="loading-message">{t('dashboard.loadingSensorData')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <button className="back-btn" onClick={() => navigate('/houses')}>
            ← {t('dashboard.backToHouses')}
          </button>
          <h1>{houseId}</h1>
        </header>
        <div className="error-message">{t('dashboard.failedToLoad')} {error}</div>
      </div>
    )
  }

  const hasData = sensorData?.data?.length > 0

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <button className="back-btn" onClick={() => navigate('/houses')}>
          ← {t('dashboard.backToHouses')}
        </button>
        <h1>{houseId}</h1>
      </header>

      {!hasData ? (
        <div className="empty-message">{t('dashboard.noSensorData')}</div>
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
              <h3>{t('dashboard.temperatureByRoom')}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={tempByRoomData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                  <XAxis dataKey="time" ticks={getHalfHourTicks(tempByRoomData).ticks} tickFormatter={getHalfHourTicks(tempByRoomData).format} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[v => Math.floor(v - 1), v => Math.ceil(v + 1)]} unit="°C" allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  {sensorData.rooms.map((room, i) => (
                    <Line key={room} type="monotone" dataKey={room} stroke={ROOM_COLORS[i % ROOM_COLORS.length]} strokeWidth={2} dot={false} name={room} />
                  ))}
                  {predictionPoints.rooms.map(room => {
                    const idx = sensorData.rooms.indexOf(room)
                    if (idx === -1) return null
                    return <Line key={`${room}_pred`} type="monotone" dataKey={`${room}_pred`} stroke={ROOM_COLORS[idx % ROOM_COLORS.length]} strokeWidth={1.5} dot={false} strokeDasharray="6 4" name={`${room} ${t('dashboard.pred')}`} />
                  })}
                  {weatherData?.data?.length > 0 && (
                    <Line type="monotone" dataKey="outside" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="8 4" name={t('dashboard.outside')} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Temperature vs Setpoint */}
            <div className="chart-card">
              <h3>
                {t('dashboard.temperatureVsSetpoint')}
                {sensorData.rooms.length > 1 && (
                  <select
                    value={selectedRoom || ''}
                    onChange={e => setSelectedRoom(e.target.value)}
                    style={{ marginLeft: 12, fontSize: 13, padding: '4px 10px', background: 'var(--bg-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}
                  >
                    {sensorData.rooms.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                )}
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={tempVsSetpointData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                  <XAxis dataKey="time" ticks={getHalfHourTicks(tempVsSetpointData).ticks} tickFormatter={getHalfHourTicks(tempVsSetpointData).format} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[v => Math.floor(v - 1), v => Math.ceil(v + 1)]} unit="°C" allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="temperature" stroke="#10b981" strokeWidth={2} dot={false} name={t('dashboard.actualC')} />
                  <Line type="monotone" dataKey="setpoint" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" name={t('dashboard.setpointC')} />
                  {predictionPoints.rooms.includes(selectedRoom) && (
                    <Line type="monotone" dataKey="temp_pred" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="6 4" name={t('dashboard.predictedC')} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Motion Activity */}
            <div className="chart-card">
              <h3>{t('dashboard.motionActivity')}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={motionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                  <XAxis dataKey="time" ticks={getHalfHourTicks(motionData).ticks} tickFormatter={getHalfHourTicks(motionData).format} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
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
                <h3>{t('dashboard.humidityCo2')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={humidityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                    <XAxis dataKey="time" ticks={getHalfHourTicks(humidityData).ticks} tickFormatter={getHalfHourTicks(humidityData).format} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <YAxis yAxisId="humidity" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} unit="%" allowDecimals={false} />
                    <YAxis yAxisId="co2" orientation="right" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} unit=" ppm" allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                    {humidityRooms.map((room, i) => (
                      <Line key={`${room}-h`} yAxisId="humidity" type="monotone" dataKey={`${room} humidity`} stroke={ROOM_COLORS[i % ROOM_COLORS.length]} strokeWidth={2} dot={false} />
                    ))}
                    {humidityRooms.map((room, i) => (
                      <Line key={`${room}-c`} yAxisId="co2" type="monotone" dataKey={`${room} CO2`} stroke={ROOM_COLORS[(i + 5) % ROOM_COLORS.length]} strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Electricity (conditional) */}
            {electricityData.length > 0 && (
              <div className="chart-card">
                <h3>{t('dashboard.electricity')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={electricityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                    <XAxis dataKey="time" ticks={getHalfHourTicks(electricityData).ticks} tickFormatter={getHalfHourTicks(electricityData).format} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} unit=" kW" allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                    {tariffHighX && (
                      <ReferenceLine x={tariffHighX} stroke="var(--accent-red)" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: t('dashboard.tariffHigh'), fill: 'var(--accent-red)', fontSize: 11, position: 'insideTopRight', offset: 4 }} />
                    )}
                    {tariffLowX && (
                      <ReferenceLine x={tariffLowX} stroke="var(--accent-green)" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: t('dashboard.tariffLow'), fill: 'var(--accent-green)', fontSize: 11, position: 'insideTopRight', offset: 4 }} />
                    )}
                    <Line type="monotone" dataKey="draw" stroke="#f59e0b" strokeWidth={2} dot={false} name={t('dashboard.drawW')} />
                    <Line type="monotone" dataKey="return" stroke="#10b981" strokeWidth={2} dot={false} name={t('dashboard.returnW')} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Gas (conditional) */}
            {gasData.length > 0 && (
              <div className="chart-card">
                <h3>{t('dashboard.gasUsage')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={gasData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                    <XAxis dataKey="time" ticks={getHalfHourTicks(gasData).ticks} tickFormatter={getHalfHourTicks(gasData).format} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} unit=" m³" allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                    <Line type="monotone" dataKey="gas" stroke="#8b5cf6" strokeWidth={2} dot={false} name={t('dashboard.usageM3')} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Appliance Power (conditional) */}
            {applianceNames.length > 0 && (
              <div className="chart-card">
                <h3>{t('dashboard.appliancePower')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={applianceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                    <XAxis dataKey="time" ticks={getHalfHourTicks(applianceChartData).ticks} tickFormatter={getHalfHourTicks(applianceChartData).format} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} unit=" W" allowDecimals={false} />
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

          {/* AI Analysis */}
          <div className="admin-section analysis-section">
            <div className="section-header">
              <h2>{t('dashboard.aiAnalysis')}</h2>
              <div className="analysis-controls">
                <select
                  className="analysis-lang-select"
                  value={analysisLang}
                  onChange={(e) => setAnalysisLang(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="nl">Nederlands</option>
                </select>
                <button
                  className="send-btn"
                  disabled={analysisLoading}
                  onClick={async () => {
                    if (analysis) { setAnalysisOpen(!analysisOpen); return }
                    setAnalysisOpen(true)
                    setAnalysisLoading(true)
                    try {
                      const result = await generateHouseAnalysis(houseId, analysisLang)
                      setAnalysis(result)
                    } catch (err) {
                      setAnalysis({ error: err.message })
                    } finally {
                      setAnalysisLoading(false)
                    }
                  }}
                >
                  {analysisLoading ? t('dashboard.analyzing') : analysis ? (analysisOpen ? t('dashboard.hideAnalysis') : t('dashboard.showAnalysis')) : t('dashboard.generateAnalysis')}
                </button>
              </div>
            </div>
            {analysisOpen && (
              <div className="analysis-content">
                {analysisLoading && <div className="loading">{t('dashboard.analyzingHouse')}</div>}
                {analysis?.error && <div className="survey-error">{analysis.error}</div>}
                {analysis?.analysis && (
                  <>
                    <div className="analysis-markdown" dangerouslySetInnerHTML={{ __html: markdownToHtml(analysis.analysis) }} />
                    <div className="analysis-meta">
                      {t('dashboard.generatedAt')}: {new Date(analysis.generatedAt).toLocaleString()}
                      {analysis.generatedBy && ` — ${analysis.generatedBy}`}
                    </div>
                    <button
                      className="cancel-btn"
                      style={{ marginTop: 12 }}
                      disabled={analysisLoading}
                      onClick={async () => {
                        setAnalysisLoading(true)
                        try {
                          const result = await generateHouseAnalysis(houseId, analysisLang)
                          setAnalysis(result)
                        } catch (err) {
                          setAnalysis({ error: err.message })
                        } finally {
                          setAnalysisLoading(false)
                        }
                      }}
                    >
                      {t('dashboard.regenerate')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Simple markdown to HTML (headings, bold, bullets, paragraphs)
function markdownToHtml(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, (m) => m ? `<p>${m}` : '')
    .replace(/<p><\/p>/g, '')
}

export default HouseDashboard
