import { query, getClient } from '../db/index.js'

class TwinService {
  async storeSensorData(houseId, timestamp, rooms) {
    const client = await getClient()

    try {
      await client.query('BEGIN')

      for (const [roomName, data] of Object.entries(rooms)) {
        await client.query(
          `INSERT INTO twin_sensor_data (house_id, room_name, temperature, temperature_set, pir, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (house_id, room_name, recorded_at)
           DO UPDATE SET temperature = EXCLUDED.temperature,
                         temperature_set = EXCLUDED.temperature_set,
                         pir = EXCLUDED.pir`,
          [houseId, roomName, data.temperature ?? null, data.temperature_set ?? null, data.pir ?? null, timestamp]
        )
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async storePrediction(houseId, prediction) {
    const result = await query(
      `INSERT INTO twin_predictions (house_id, prediction, predicted_at)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [houseId, JSON.stringify(prediction)]
    )
    return result.rows[0]
  }

  async getLatestState(houseId) {
    const result = await query(
      `SELECT DISTINCT ON (room_name)
         room_name, temperature, temperature_set, pir, recorded_at
       FROM twin_sensor_data
       WHERE house_id = $1
       ORDER BY room_name, recorded_at DESC`,
      [houseId]
    )
    return result.rows
  }

  async getLatestPrediction(houseId) {
    const result = await query(
      `SELECT * FROM twin_predictions
       WHERE house_id = $1
       ORDER BY predicted_at DESC
       LIMIT 1`,
      [houseId]
    )
    return result.rows[0] || null
  }

  async getSensorHistory(houseId, hours = 24) {
    const result = await query(
      `SELECT room_name, temperature, temperature_set, pir, recorded_at
       FROM twin_sensor_data
       WHERE house_id = $1 AND recorded_at >= NOW() - INTERVAL '1 hour' * $2
       ORDER BY recorded_at DESC`,
      [houseId, hours]
    )
    return result.rows
  }
}

export default new TwinService()
