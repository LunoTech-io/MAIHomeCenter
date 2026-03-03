import { useMemo } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import NotificationButton from './NotificationButton'
import { useAuth } from '../contexts/AuthContext'
import houseData from '../data/dummyData'

const chartTooltipStyle = {
  backgroundColor: '#16213e',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#fff'
}

function Dashboard() {
  const { house } = useAuth()
  const houseId = house?.houseId || 'demo-house'
  const data = houseData[houseId] || houseData['demo-house']

  const { currentValues } = data

  const widgets = [
    { icon: '🌡️', value: `${currentValues.temperature}°C`, label: 'Temperature', color: 'green' },
    { icon: '💧', value: `${currentValues.humidity}%`, label: 'Humidity', color: 'blue' },
    { icon: '⚡', value: `${currentValues.power}W`, label: 'Power', color: 'yellow' },
    { icon: '🔥', value: `${currentValues.gas} m³`, label: 'Gas', color: 'red' }
  ]

  const tempHumidityData = useMemo(() =>
    data.temperature.map((d, i) => ({
      time: d.time,
      temperature: d.value,
      humidity: data.humidity[i].value
    })), [data])

  const lightOccupancyData = useMemo(() =>
    data.light.map((d, i) => ({
      time: d.time,
      light: d.value,
      occupancy: data.occupancy[i].value
    })), [data])

  const powerChartData = useMemo(() =>
    data.power.map((d) => ({ time: d.time, power: d.value })), [data])

  const energyData = useMemo(() =>
    data.energyTariff.map((d) => ({
      time: d.time,
      tariff1: d.value.tariff1,
      tariff2: d.value.tariff2,
    })), [data])

  const gasChartData = useMemo(() =>
    data.gas.map((d) => ({ time: d.time, gas: d.value })), [data])

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>MAIHomeCenter</h1>
        <p>{house?.name || 'Dashboard'} — {data.season} profile</p>
      </header>

      <div className="widget-grid">
        {widgets.map((widget, index) => (
          <div key={index} className="widget">
            <div className={`widget-icon ${widget.color}`}>
              {widget.icon}
            </div>
            <div className="widget-value">{widget.value}</div>
            <div className="widget-label">{widget.label}</div>
          </div>
        ))}
      </div>

      <div className="chart-section">
        {/* Temperature & Humidity */}
        <div className="chart-card">
          <h3>Temperature & Humidity (24h)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={tempHumidityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 10, angle: -90, textAnchor: 'end' }} interval={11} height={50} />
              <YAxis yAxisId="temp" tick={{ fill: '#a0aec0', fontSize: 11 }} domain={['dataMin - 2', 'dataMax + 2']} unit="°C" />
              <YAxis yAxisId="hum" orientation="right" tick={{ fill: '#a0aec0', fontSize: 11 }} domain={['dataMin - 5', 'dataMax + 5']} unit="%" />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend />
              <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke="#10b981" strokeWidth={2} dot={false} name="Temp °C" />
              <Line yAxisId="hum" type="monotone" dataKey="humidity" stroke="#3b82f6" strokeWidth={2} dot={false} name="Humidity %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Light & Occupancy */}
        <div className="chart-card">
          <h3>Light Level & Occupancy (24h)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={lightOccupancyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 10, angle: -90, textAnchor: 'end' }} interval={11} height={50} />
              <YAxis yAxisId="light" tick={{ fill: '#a0aec0', fontSize: 11 }} unit=" lux" />
              <YAxis yAxisId="occ" orientation="right" tick={{ fill: '#a0aec0', fontSize: 11 }} domain={[0, 1]} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend />
              <Bar yAxisId="light" dataKey="light" fill="#f59e0b" opacity={0.7} name="Light (lux)" />
              <Bar yAxisId="occ" dataKey="occupancy" fill="#8b5cf6" opacity={0.5} name="Occupancy" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Power Consumption */}
        <div className="chart-card">
          <h3>Power Consumption (24h)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={powerChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 10, angle: -90, textAnchor: 'end' }} interval={11} height={50} />
              <YAxis tick={{ fill: '#a0aec0', fontSize: 11 }} unit="W" />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="power" stroke="#ef4444" fill="rgba(239,68,68,0.2)" strokeWidth={2} name="Power (W)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Electricity — tariff breakdown */}
        <div className="chart-card">
          <h3>Electricity by Tariff (24h)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={energyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 10, angle: -90, textAnchor: 'end' }} interval={11} height={50} />
              <YAxis tick={{ fill: '#a0aec0', fontSize: 11 }} unit=" kWh" />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="tariff1" stroke="#3b82f6" strokeWidth={2} dot={false} name="Day tariff (kWh)" />
              <Line type="monotone" dataKey="tariff2" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Night tariff (kWh)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gas consumption */}
        <div className="chart-card">
          <h3>Gas Consumption (24h)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={gasChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 10, angle: -90, textAnchor: 'end' }} interval={11} height={50} />
              <YAxis tick={{ fill: '#a0aec0', fontSize: 11 }} unit=" m³" />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="gas" stroke="#f59e0b" fill="rgba(245,158,11,0.2)" strokeWidth={2} name="Gas (m³)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="notification-section">
        <h2>Notifications</h2>
        <NotificationButton />
      </div>
    </div>
  )
}

export default Dashboard
