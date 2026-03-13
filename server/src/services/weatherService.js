import { query } from '../db/index.js'

const POLL_INTERVAL = 15 * 60 * 1000 // 15 minutes
const STARTUP_DELAY = 20_000          // 20 seconds

class WeatherService {
  constructor() {
    this.isPolling = false
  }

  /**
   * Bucket a date to the nearest 15-minute interval
   */
  bucketTo15Min(date) {
    const d = new Date(date)
    d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0)
    return d
  }

  /**
   * Poll Open-Meteo for current temperature at each unique coordinate pair,
   * then upsert weather_data for all houses at those coordinates.
   */
  async pollWeather() {
    if (this.isPolling) {
      console.log('[weather] poll already in progress, skipping')
      return
    }
    this.isPolling = true

    try {
      // Get unique coordinate groups with their house IDs
      const { rows } = await query(`
        SELECT latitude, longitude, array_agg(house_id) AS house_ids
        FROM houses
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        GROUP BY latitude, longitude
      `)

      if (rows.length === 0) {
        console.log('[weather] no houses with coordinates, skipping')
        return
      }

      const recordedAt = this.bucketTo15Min(new Date())
      let totalHouses = 0

      for (const { latitude, longitude, house_ids } of rows) {
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`
          const response = await fetch(url)

          if (!response.ok) {
            console.error(`[weather] Open-Meteo error for (${latitude},${longitude}): ${response.status}`)
            continue
          }

          const data = await response.json()
          const temperature = data.current?.temperature_2m

          if (temperature == null) {
            console.error(`[weather] no temperature in response for (${latitude},${longitude})`)
            continue
          }

          // Upsert for all houses at these coordinates
          for (const houseId of house_ids) {
            await query(
              `INSERT INTO weather_data (house_id, temperature, recorded_at)
               VALUES ($1, $2, $3)
               ON CONFLICT (house_id, recorded_at)
               DO UPDATE SET temperature = EXCLUDED.temperature`,
              [houseId, temperature, recordedAt]
            )
            totalHouses++
          }
        } catch (err) {
          console.error(`[weather] fetch failed for (${latitude},${longitude}):`, err.message)
        }
      }

      console.log(`[weather] polled ${rows.length} coordinate(s), updated ${totalHouses} house(s)`)
    } catch (err) {
      console.error('[weather] poll error:', err)
    } finally {
      this.isPolling = false
    }
  }

  /**
   * Get the most recent weather reading for a house
   */
  async getLatestWeather(houseId) {
    const { rows } = await query(
      `SELECT temperature, recorded_at
       FROM weather_data
       WHERE house_id = $1
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [houseId]
    )
    return rows[0] || null
  }

  /**
   * Get weather history for a house.
   * For ≤24h: returns raw data.
   * For >24h: unions raw data with hourly aggregates for the older period.
   */
  async getWeatherHistory(houseId, hours = 24) {
    if (hours <= 24) {
      const { rows } = await query(
        `SELECT temperature, recorded_at
         FROM weather_data
         WHERE house_id = $1 AND recorded_at >= NOW() - INTERVAL '${hours} hours'
         ORDER BY recorded_at ASC`,
        [houseId]
      )
      return rows
    }

    // For longer periods, union raw (recent) with hourly (older)
    const { rows } = await query(
      `SELECT temperature, recorded_at FROM weather_data
       WHERE house_id = $1 AND recorded_at >= NOW() - INTERVAL '24 hours'
       UNION ALL
       SELECT avg_temperature AS temperature, hour_bucket AS recorded_at FROM weather_data_hourly
       WHERE house_id = $1
         AND hour_bucket >= NOW() - INTERVAL '${hours} hours'
         AND hour_bucket < NOW() - INTERVAL '24 hours'
       ORDER BY recorded_at ASC`,
      [houseId]
    )
    return rows
  }
}

const weatherService = new WeatherService()

let intervalId = null

export function startWeatherCron() {
  console.log('[weather] cron started — polls every 15 minutes')

  setTimeout(() => weatherService.pollWeather(), STARTUP_DELAY)

  intervalId = setInterval(() => weatherService.pollWeather(), POLL_INTERVAL)
}

export function stopWeatherCron() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[weather] cron stopped')
  }
}

export default weatherService
