import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import NotificationButton from './NotificationButton'
import {
  temperatureData, humidityData, lightData, occupancyData,
  powerData, energyTariffData, gasData, currentValues
} from '../data/dummyData'

const widgets = [
  { icon: '🌡️', value: `${currentValues.temperature}°C`, label: 'Temperature', color: 'green' },
  { icon: '💧', value: `${currentValues.humidity}%`, label: 'Humidity', color: 'blue' },
  { icon: '⚡', value: `${currentValues.power}W`, label: 'Power', color: 'yellow' },
  { icon: '🔥', value: `${currentValues.gas} m³`, label: 'Gas', color: 'red' }
]

// Merge temperature & humidity into one series for the dual-axis chart
const tempHumidityData = temperatureData.map((d, i) => ({
  time: d.time,
  temperature: d.value,
  humidity: humidityData[i].value
}))

// Merge light & occupancy
const lightOccupancyData = lightData.map((d, i) => ({
  time: d.time,
  light: d.value,
  occupancy: occupancyData[i].value
}))

// Power series
const powerChartData = powerData.map((d) => ({ time: d.time, power: d.value }))

// Energy tariff + gas
const energyGasData = energyTariffData.map((d, i) => ({
  time: d.time,
  tariff1: d.value.tariff1,
  tariff2: d.value.tariff2,
  gas: gasData[i].value
}))

// Show every 12th label (every 2 hours) to avoid clutter
const tickFilter = (tick, index) => index % 12 === 0

const chartTooltipStyle = {
  backgroundColor: '#16213e',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#fff'
}

function Dashboard() {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>MAIHomeCenter</h1>
        <p>Welcome home! Everything is running smoothly.</p>
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
              <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 11 }} tickFormatter={tickFilter} interval={11} />
              <YAxis yAxisId="temp" tick={{ fill: '#a0aec0', fontSize: 11 }} domain={[16, 26]} unit="°C" />
              <YAxis yAxisId="hum" orientation="right" tick={{ fill: '#a0aec0', fontSize: 11 }} domain={[30, 70]} unit="%" />
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
              <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 11 }} interval={11} />
              <YAxis yAxisId="light" tick={{ fill: '#a0aec0', fontSize: 11 }} domain={[0, 200]} unit=" lux" />
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
              <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 11 }} interval={11} />
              <YAxis tick={{ fill: '#a0aec0', fontSize: 11 }} unit="W" />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="power" stroke="#ef4444" fill="rgba(239,68,68,0.2)" strokeWidth={2} name="Power (W)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Energy Tariffs & Gas */}
        <div className="chart-card">
          <h3>Energy Tariffs & Gas (24h)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={energyGasData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="time" tick={{ fill: '#a0aec0', fontSize: 11 }} interval={11} />
              <YAxis yAxisId="kwh" tick={{ fill: '#a0aec0', fontSize: 11 }} unit=" kWh" />
              <YAxis yAxisId="gas" orientation="right" tick={{ fill: '#a0aec0', fontSize: 11 }} unit=" m³" />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend />
              <Line yAxisId="kwh" type="monotone" dataKey="tariff1" stroke="#3b82f6" strokeWidth={2} dot={false} name="Tariff 1 (day)" />
              <Line yAxisId="kwh" type="monotone" dataKey="tariff2" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Tariff 2 (night)" />
              <Line yAxisId="gas" type="monotone" dataKey="gas" stroke="#f59e0b" strokeWidth={2} dot={false} name="Gas (m³)" />
            </LineChart>
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
