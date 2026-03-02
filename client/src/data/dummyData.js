// Per-household dummy sensor data — 24h of 10-minute intervals (144 points)
// Profiles derived from anonymized sample data:
//   HOUSE001 → alfa  (January / winter)
//   HOUSE002 → beta  (November / autumn)
//   HOUSE003 → delta (April / spring)
//   HOUSE004 → gamma (July / summer)

// ── helpers ──────────────────────────────────────────────────────────

function generateTimeSeries(startHour, generatorFn) {
  const data = []
  for (let i = 0; i < 144; i++) {
    const minutesSinceStart = i * 10
    const hour = (startHour + minutesSinceStart / 60) % 24
    const time = `${String(Math.floor(hour)).padStart(2, '0')}:${String(
      Math.round((hour % 1) * 60)
    ).padStart(2, '0')}`
    data.push({ time, value: generatorFn(hour, i) })
  }
  return data
}

function activityFactor(hour) {
  if (hour >= 0 && hour < 6) return 0.1
  if (hour >= 6 && hour < 9) return 0.7 + (hour - 6) * 0.1
  if (hour >= 9 && hour < 12) return 0.5
  if (hour >= 12 && hour < 14) return 0.6
  if (hour >= 14 && hour < 17) return 0.4
  if (hour >= 17 && hour < 21) return 0.8 + (hour - 17) * 0.05
  return 0.3
}

function noise(amplitude) {
  return (Math.random() - 0.5) * 2 * amplitude
}

// ── house profiles (ranges from real sample data) ────────────────────

const profiles = {
  // HOUSE001 — alfa — Winter (January)
  HOUSE001: {
    season: 'Winter',
    temp: { nightBase: 14.5, dayBase: 16.0, heatingAm: 1.5, heatingPm: 1.0, noise: 0.5 },
    humidity: { base: 45, showerSpike: 4, cookingSpike: 3, noise: 1.5 },
    co2: { base: 550, activityMul: 200, noise: 40 },
    light: { nightMax: 2, dawnBase: 5, dayBase: 30, eveningBase: 50, noise: 8 },
    power: { baseW: 80, activityMulW: 400, spikeW: 1600, spikeProb: 0.04, noise: 30 },
    tariff: { t1Start: 9734, t2Start: 9263 },
    gas: { start: 9265, heatingAm: 0.025, heatingPm: 0.020, idle: 0.008, cooking: 0.010 },
  },

  // HOUSE002 — beta — Autumn (November), high humidity, high CO2
  HOUSE002: {
    season: 'Autumn',
    temp: { nightBase: 19.0, dayBase: 20.8, heatingAm: 0.8, heatingPm: 0.6, noise: 0.4 },
    humidity: { base: 62, showerSpike: 6, cookingSpike: 5, noise: 2.0 },
    co2: { base: 1200, activityMul: 900, noise: 120 },
    light: { nightMax: 2, dawnBase: 8, dayBase: 40, eveningBase: 60, noise: 10 },
    power: { baseW: 260, activityMulW: 1600, spikeW: 3200, spikeProb: 0.06, noise: 80 },
    tariff: { t1Start: 14865, t2Start: 15627 },
    gas: { start: 3676, heatingAm: 0.018, heatingPm: 0.015, idle: 0.005, cooking: 0.008 },
  },

  // HOUSE003 — delta — Spring (April), low power, moderate temps
  HOUSE003: {
    season: 'Spring',
    temp: { nightBase: 15.0, dayBase: 17.0, heatingAm: 1.0, heatingPm: 0.7, noise: 0.6 },
    humidity: { base: 42, showerSpike: 5, cookingSpike: 3, noise: 1.8 },
    co2: { base: 430, activityMul: 200, noise: 35 },
    light: { nightMax: 2, dawnBase: 15, dayBase: 100, eveningBase: 60, noise: 15 },
    power: { baseW: 40, activityMulW: 300, spikeW: 1500, spikeProb: 0.03, noise: 20 },
    tariff: { t1Start: 5483, t2Start: 5032 },
    gas: { start: 5560, heatingAm: 0.012, heatingPm: 0.008, idle: 0.003, cooking: 0.006 },
  },

  // HOUSE004 — gamma — Summer (July), hot, no heating, higher power
  HOUSE004: {
    season: 'Summer',
    temp: { nightBase: 25.0, dayBase: 27.0, heatingAm: 0, heatingPm: 0, noise: 0.6 },
    humidity: { base: 44, showerSpike: 6, cookingSpike: 4, noise: 2.5 },
    co2: { base: 1000, activityMul: 200, noise: 50 },
    light: { nightMax: 3, dawnBase: 30, dayBase: 150, eveningBase: 70, noise: 20 },
    power: { baseW: 780, activityMulW: 1000, spikeW: 2000, spikeProb: 0.05, noise: 60 },
    tariff: { t1Start: 13949, t2Start: 14592 },
    gas: { start: 3576, heatingAm: 0.002, heatingPm: 0.002, idle: 0.001, cooking: 0.006 },
  },
}

// ── generators ───────────────────────────────────────────────────────

function buildHouseData(p) {
  const temperature = generateTimeSeries(0, (hour) => {
    const base = hour >= 6 && hour < 22 ? p.temp.dayBase : p.temp.nightBase
    const heating =
      hour >= 7 && hour < 9 ? p.temp.heatingAm : hour >= 17 && hour < 20 ? p.temp.heatingPm : 0
    return +(base + heating + noise(p.temp.noise)).toFixed(1)
  })

  const humidity = generateTimeSeries(0, (hour) => {
    const shower = hour >= 7 && hour < 8 ? p.humidity.showerSpike : 0
    const cooking = hour >= 18 && hour < 19.5 ? p.humidity.cookingSpike : 0
    return +(p.humidity.base + shower + cooking + noise(p.humidity.noise)).toFixed(1)
  })

  const co2 = generateTimeSeries(0, (hour) => {
    return Math.round(p.co2.base + activityFactor(hour) * p.co2.activityMul + noise(p.co2.noise))
  })

  const light = generateTimeSeries(0, (hour) => {
    if (hour >= 0 && hour < 6) return Math.max(0, Math.round(noise(p.light.nightMax)))
    if (hour >= 6 && hour < 8)
      return Math.round(p.light.dawnBase + (hour - 6) * 20 + noise(p.light.noise))
    if (hour >= 8 && hour < 17) return Math.round(p.light.dayBase + noise(p.light.noise))
    if (hour >= 17 && hour < 22) return Math.round(p.light.eveningBase + noise(p.light.noise))
    return Math.max(0, Math.round(5 + noise(3)))
  })

  const occupancy = generateTimeSeries(0, (hour) => {
    return Math.random() < activityFactor(hour) ? 1 : 0
  })

  const power = generateTimeSeries(0, (hour) => {
    const spike = Math.random() < p.power.spikeProb ? p.power.spikeW : 0
    return Math.max(
      0,
      Math.round(
        p.power.baseW + activityFactor(hour) * p.power.activityMulW + spike + noise(p.power.noise)
      )
    )
  })

  const energyTariff = (() => {
    let t1 = p.tariff.t1Start
    let t2 = p.tariff.t2Start
    return generateTimeSeries(0, (hour) => {
      const w =
        p.power.baseW + activityFactor(hour) * p.power.activityMulW + noise(p.power.noise)
      const kwh = Math.max(0, w) / 6000
      if (hour >= 7 && hour < 23) {
        t1 += kwh
      } else {
        t2 += kwh
      }
      return { tariff1: +t1.toFixed(2), tariff2: +t2.toFixed(2) }
    })
  })()

  const gas = (() => {
    let cum = p.gas.start
    return generateTimeSeries(0, (hour) => {
      const heating =
        hour >= 6 && hour < 9 ? p.gas.heatingAm : hour >= 17 && hour < 21 ? p.gas.heatingPm : p.gas.idle
      const cooking = hour >= 18 && hour < 19.5 ? p.gas.cooking : 0
      cum += heating + cooking + Math.max(0, noise(0.002))
      return +cum.toFixed(3)
    })
  })()

  const latest = (arr) => arr[arr.length - 1]
  const currentValues = {
    temperature: latest(temperature).value,
    humidity: latest(humidity).value,
    co2: latest(co2).value,
    power: latest(power).value,
    gas: latest(gas).value,
  }

  return {
    season: p.season,
    temperature,
    humidity,
    co2,
    light,
    occupancy,
    power,
    energyTariff,
    gas,
    currentValues,
  }
}

// ── pre-build all four houses ────────────────────────────────────────

const houseData = {}
for (const [id, profile] of Object.entries(profiles)) {
  houseData[id] = buildHouseData(profile)
}

// Fallback used by demo mode
houseData['demo-house'] = houseData['HOUSE001']

export default houseData
