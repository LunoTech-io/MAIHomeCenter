// Dummy smart home sensor data — 24h of 10-minute intervals (144 points)
// Patterns modelled on AM307, WT101, WS202 and smart meter readings

function generateTimeSeries(startHour, generatorFn) {
  const data = []
  for (let i = 0; i < 144; i++) {
    const minutesSinceStart = i * 10
    const hour = (startHour + minutesSinceStart / 60) % 24
    const time = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`
    data.push({ time, value: generatorFn(hour, i) })
  }
  return data
}

// Diurnal activity multiplier: low at night, peaks morning & evening
function activityFactor(hour) {
  if (hour >= 0 && hour < 6) return 0.1
  if (hour >= 6 && hour < 9) return 0.7 + (hour - 6) * 0.1   // morning ramp
  if (hour >= 9 && hour < 12) return 0.5
  if (hour >= 12 && hour < 14) return 0.6                     // lunch
  if (hour >= 14 && hour < 17) return 0.4
  if (hour >= 17 && hour < 21) return 0.8 + (hour - 17) * 0.05 // evening peak
  return 0.3 // 21-24 winding down
}

function noise(amplitude) {
  return (Math.random() - 0.5) * 2 * amplitude
}

// --- Temperature (°C) — AM307 Living + WT101 rooms ---
// Night ~18°C, daytime ~21-23°C with heating cycles
export const temperatureData = generateTimeSeries(0, (hour) => {
  const base = hour >= 6 && hour < 22 ? 21.5 : 18.5
  const heating = hour >= 7 && hour < 9 ? 1.2 : hour >= 17 && hour < 20 ? 0.8 : 0
  return +(base + heating + noise(0.5)).toFixed(1)
})

// --- Humidity (%) — AM307 Living ---
// Stable 45-55%, spikes near cooking/showering times
export const humidityData = generateTimeSeries(0, (hour) => {
  const base = 48
  const shower = hour >= 7 && hour < 8 ? 8 : 0
  const cooking = hour >= 18 && hour < 19.5 ? 6 : 0
  return +(base + shower + cooking + noise(2.5)).toFixed(1)
})

// --- Light Level (lux) — WS202 sensors ---
// 0 at night, natural light during day, artificial in evening
export const lightData = generateTimeSeries(0, (hour) => {
  if (hour >= 0 && hour < 6) return Math.max(0, Math.round(noise(3)))
  if (hour >= 6 && hour < 8) return Math.round(20 + (hour - 6) * 40 + noise(10))
  if (hour >= 8 && hour < 17) return Math.round(120 + noise(30))  // daylight
  if (hour >= 17 && hour < 22) return Math.round(80 + noise(15))  // artificial
  return Math.max(0, Math.round(10 + noise(5)))
})

// --- Occupancy (PIR) — WS202 motion ---
// Binary 0/1, higher probability during active hours
export const occupancyData = generateTimeSeries(0, (hour) => {
  const prob = activityFactor(hour)
  return Math.random() < prob ? 1 : 0
})

// --- Power Consumption (W) — Smart meter positive_active_power ---
// Base ~300W, peaks with appliances during active hours
export const powerData = generateTimeSeries(0, (hour) => {
  const base = 300
  const activity = activityFactor(hour) * 1800
  const spike = Math.random() < 0.08 ? 600 : 0  // occasional appliance spike
  return Math.round(base + activity + spike + noise(100))
})

// --- Energy Tariffs (cumulative kWh) — tariff1 (day) / tariff2 (night) ---
export const energyTariffData = (() => {
  let tariff1 = 4521.3  // day tariff start
  let tariff2 = 2134.7  // night tariff start
  return generateTimeSeries(0, (hour, i) => {
    const consumption = (300 + activityFactor(hour) * 1800 + noise(100)) / 6000 // kWh per 10min
    if (hour >= 7 && hour < 23) {
      tariff1 += Math.max(0, consumption)
    } else {
      tariff2 += Math.max(0, consumption)
    }
    return { tariff1: +tariff1.toFixed(2), tariff2: +tariff2.toFixed(2) }
  })
})()

// --- Gas Consumption (cumulative m³) — smart meter gas.kuub ---
// Slow accumulation, faster during heating and cooking hours
export const gasData = (() => {
  let cumulative = 1823.45
  return generateTimeSeries(0, (hour) => {
    const heatingRate = hour >= 6 && hour < 9 ? 0.015 : hour >= 17 && hour < 21 ? 0.012 : 0.003
    const cookingRate = hour >= 18 && hour < 19.5 ? 0.008 : 0
    cumulative += heatingRate + cookingRate + Math.max(0, noise(0.002))
    return +cumulative.toFixed(3)
  })
})()

// --- Current / latest values for summary widgets ---
const latest = (arr) => arr[arr.length - 1]

export const currentValues = {
  temperature: latest(temperatureData).value,
  humidity: latest(humidityData).value,
  power: latest(powerData).value,
  gas: latest(gasData).value,
}
