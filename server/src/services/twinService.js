import { query, getClient } from '../db/index.js'

class TwinService {
  async storeSensorData(houseId, timestamp, rooms, meter, appliances, water) {
    const client = await getClient()

    try {
      await client.query('BEGIN')

      // Room sensor data (extended with environment fields)
      for (const [roomName, data] of Object.entries(rooms)) {
        await client.query(
          `INSERT INTO twin_sensor_data
             (house_id, room_name, temperature, temperature_set, pir,
              humidity, co2, light_level, pressure, tvoc, valve_position, door_status,
              recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (house_id, room_name, recorded_at)
           DO UPDATE SET
             temperature    = COALESCE(EXCLUDED.temperature, twin_sensor_data.temperature),
             temperature_set = COALESCE(EXCLUDED.temperature_set, twin_sensor_data.temperature_set),
             pir            = COALESCE(EXCLUDED.pir, twin_sensor_data.pir),
             humidity       = COALESCE(EXCLUDED.humidity, twin_sensor_data.humidity),
             co2            = COALESCE(EXCLUDED.co2, twin_sensor_data.co2),
             light_level    = COALESCE(EXCLUDED.light_level, twin_sensor_data.light_level),
             pressure       = COALESCE(EXCLUDED.pressure, twin_sensor_data.pressure),
             tvoc           = COALESCE(EXCLUDED.tvoc, twin_sensor_data.tvoc),
             valve_position = COALESCE(EXCLUDED.valve_position, twin_sensor_data.valve_position),
             door_status    = COALESCE(EXCLUDED.door_status, twin_sensor_data.door_status)`,
          [
            houseId, roomName,
            data.temperature ?? null, data.temperature_set ?? null, data.pir ?? null,
            data.humidity ?? null, data.co2 ?? null, data.light_level ?? null,
            data.pressure ?? null, data.tvoc ?? null, data.valve_position ?? null,
            data.door_status ?? null,
            timestamp
          ]
        )
      }

      // Meter data (electricity + gas)
      if (meter && Object.keys(meter).length > 0) {
        await client.query(
          `INSERT INTO twin_meter_data
             (house_id, positive_active_power, negative_active_power, gas_kuub,
              tariff1_pos_energy, tariff2_pos_energy, tariff1_neg_energy, tariff2_neg_energy,
              current_tariff, phase_a_current, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (house_id, recorded_at)
           DO UPDATE SET
             positive_active_power = COALESCE(EXCLUDED.positive_active_power, twin_meter_data.positive_active_power),
             negative_active_power = COALESCE(EXCLUDED.negative_active_power, twin_meter_data.negative_active_power),
             gas_kuub              = COALESCE(EXCLUDED.gas_kuub, twin_meter_data.gas_kuub),
             tariff1_pos_energy    = COALESCE(EXCLUDED.tariff1_pos_energy, twin_meter_data.tariff1_pos_energy),
             tariff2_pos_energy    = COALESCE(EXCLUDED.tariff2_pos_energy, twin_meter_data.tariff2_pos_energy),
             tariff1_neg_energy    = COALESCE(EXCLUDED.tariff1_neg_energy, twin_meter_data.tariff1_neg_energy),
             tariff2_neg_energy    = COALESCE(EXCLUDED.tariff2_neg_energy, twin_meter_data.tariff2_neg_energy),
             current_tariff        = COALESCE(EXCLUDED.current_tariff, twin_meter_data.current_tariff),
             phase_a_current       = COALESCE(EXCLUDED.phase_a_current, twin_meter_data.phase_a_current)`,
          [
            houseId,
            meter.positive_active_power ?? null, meter.negative_active_power ?? null,
            meter.gas_kuub ?? null,
            meter.tariff1_pos_energy ?? null, meter.tariff2_pos_energy ?? null,
            meter.tariff1_neg_energy ?? null, meter.tariff2_neg_energy ?? null,
            meter.current_tariff ?? null, meter.phase_a_current ?? null,
            timestamp
          ]
        )
      }

      // Appliance data
      if (appliances && Object.keys(appliances).length > 0) {
        for (const [appName, data] of Object.entries(appliances)) {
          await client.query(
            `INSERT INTO twin_appliance_data
               (house_id, appliance_name, active_power, current, voltage, total_active_energy, state, recorded_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (house_id, appliance_name, recorded_at)
             DO UPDATE SET
               active_power        = COALESCE(EXCLUDED.active_power, twin_appliance_data.active_power),
               current             = COALESCE(EXCLUDED.current, twin_appliance_data.current),
               voltage             = COALESCE(EXCLUDED.voltage, twin_appliance_data.voltage),
               total_active_energy = COALESCE(EXCLUDED.total_active_energy, twin_appliance_data.total_active_energy),
               state               = COALESCE(EXCLUDED.state, twin_appliance_data.state)`,
            [
              houseId, appName,
              data.active_power ?? null, data.current ?? null, data.voltage ?? null,
              data.total_active_energy ?? null, data.state ?? null,
              timestamp
            ]
          )
        }
      }

      // Water data
      if (water && Object.keys(water).length > 0) {
        await client.query(
          `INSERT INTO twin_water_data
             (house_id, pulse_count, humidity, temperature, recorded_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (house_id, recorded_at)
           DO UPDATE SET
             pulse_count = COALESCE(EXCLUDED.pulse_count, twin_water_data.pulse_count),
             humidity    = COALESCE(EXCLUDED.humidity, twin_water_data.humidity),
             temperature = COALESCE(EXCLUDED.temperature, twin_water_data.temperature)`,
          [
            houseId,
            water.pulse_count ?? null, water.humidity ?? null, water.temperature ?? null,
            timestamp
          ]
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
         room_name, temperature, temperature_set, pir,
         humidity, co2, light_level, pressure, tvoc, valve_position, door_status,
         recorded_at
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
      `SELECT room_name, temperature, temperature_set, pir,
              humidity, co2, light_level, pressure, tvoc, valve_position, door_status,
              recorded_at
       FROM twin_sensor_data
       WHERE house_id = $1 AND recorded_at >= NOW() - INTERVAL '1 hour' * $2
       ORDER BY recorded_at DESC`,
      [houseId, hours]
    )
    return result.rows
  }

  async getSensorHistoryGrouped(houseId, hours = 24) {
    // For windows > 24h, union raw (recent) with hourly aggregates (older)
    const sql = hours <= 24
      ? `SELECT room_name, temperature, temperature_set, pir,
                humidity, co2, light_level, pressure, tvoc, valve_position, door_status,
                recorded_at
         FROM twin_sensor_data
         WHERE house_id = $1 AND recorded_at >= NOW() - INTERVAL '1 hour' * $2
         ORDER BY recorded_at ASC`
      : `SELECT room_name, temperature, temperature_set, pir,
                humidity, co2, light_level, pressure, tvoc, valve_position, door_status,
                recorded_at
         FROM twin_sensor_data
         WHERE house_id = $1 AND recorded_at >= NOW() - INTERVAL '1 hour' * $2
         UNION ALL
         SELECT room_name,
                avg_temperature AS temperature, avg_temperature_set AS temperature_set,
                max_pir AS pir,
                avg_humidity AS humidity, avg_co2 AS co2, avg_light_level AS light_level,
                avg_pressure AS pressure, avg_tvoc AS tvoc,
                avg_valve_position AS valve_position, max_door_status AS door_status,
                hour_bucket AS recorded_at
         FROM twin_sensor_data_hourly
         WHERE house_id = $1 AND hour_bucket >= NOW() - INTERVAL '1 hour' * $2
           AND hour_bucket < (SELECT COALESCE(MIN(recorded_at), NOW()) FROM twin_sensor_data WHERE house_id = $1)
         ORDER BY recorded_at ASC`

    const result = await query(sql, [houseId, hours])

    const rows = result.rows
    if (rows.length === 0) {
      return { rooms: [], data: [] }
    }

    // Collect unique room names
    const roomSet = new Set()
    rows.forEach(r => roomSet.add(r.room_name))
    const rooms = [...roomSet].sort()

    // Group by timestamp
    const timeMap = new Map()
    for (const row of rows) {
      const time = row.recorded_at.toISOString()
      if (!timeMap.has(time)) {
        timeMap.set(time, { time })
      }
      const entry = timeMap.get(time)
      const room = row.room_name
      entry[`${room}_temp`] = row.temperature != null ? parseFloat(row.temperature) : null
      entry[`${room}_set`] = row.temperature_set != null ? parseFloat(row.temperature_set) : null
      entry[`${room}_pir`] = row.pir != null ? parseInt(row.pir) : null
      entry[`${room}_humidity`] = row.humidity != null ? parseFloat(row.humidity) : null
      entry[`${room}_co2`] = row.co2 != null ? parseFloat(row.co2) : null
      entry[`${room}_light`] = row.light_level != null ? parseFloat(row.light_level) : null
      entry[`${room}_tvoc`] = row.tvoc != null ? parseFloat(row.tvoc) : null
      entry[`${room}_valve`] = row.valve_position != null ? parseFloat(row.valve_position) : null
      entry[`${room}_door`] = row.door_status != null ? parseInt(row.door_status) : null
    }

    return { rooms, data: [...timeMap.values()] }
  }

  async getMeterHistory(houseId, hours = 24) {
    const sql = hours <= 24
      ? `SELECT positive_active_power, negative_active_power, gas_kuub,
                tariff1_pos_energy, tariff2_pos_energy,
                tariff1_neg_energy, tariff2_neg_energy,
                current_tariff, phase_a_current, recorded_at
         FROM twin_meter_data
         WHERE house_id = $1 AND recorded_at >= NOW() - INTERVAL '1 hour' * $2
         ORDER BY recorded_at ASC`
      : `SELECT positive_active_power, negative_active_power, gas_kuub,
                tariff1_pos_energy, tariff2_pos_energy,
                tariff1_neg_energy, tariff2_neg_energy,
                current_tariff, phase_a_current, recorded_at
         FROM twin_meter_data
         WHERE house_id = $1 AND recorded_at >= NOW() - INTERVAL '1 hour' * $2
         UNION ALL
         SELECT avg_positive_active_power, avg_negative_active_power, max_gas_kuub,
                max_tariff1_pos_energy, max_tariff2_pos_energy,
                max_tariff1_neg_energy, max_tariff2_neg_energy,
                last_current_tariff, avg_phase_a_current, hour_bucket
         FROM twin_meter_data_hourly
         WHERE house_id = $1 AND hour_bucket >= NOW() - INTERVAL '1 hour' * $2
           AND hour_bucket < (SELECT COALESCE(MIN(recorded_at), NOW()) FROM twin_meter_data WHERE house_id = $1)
         ORDER BY recorded_at ASC`

    const result = await query(sql, [houseId, hours])

    // Compute gas_usage as delta between consecutive gas_kuub readings
    let prevGas = null
    return result.rows.map(row => {
      const gasKuub = row.gas_kuub != null ? parseFloat(row.gas_kuub) : null
      let gasUsage = null
      if (gasKuub != null && prevGas != null) {
        const delta = gasKuub - prevGas
        gasUsage = delta >= 0 ? Math.round(delta * 1000) / 1000 : null // ignore resets
      }
      prevGas = gasKuub

      return {
        time: row.recorded_at.toISOString(),
        positive_active_power: row.positive_active_power != null ? parseFloat(row.positive_active_power) : null,
        negative_active_power: row.negative_active_power != null ? parseFloat(row.negative_active_power) : null,
        gas_kuub: gasKuub,
        gas_usage: gasUsage,
        tariff1_pos_energy: row.tariff1_pos_energy != null ? parseFloat(row.tariff1_pos_energy) : null,
        tariff2_pos_energy: row.tariff2_pos_energy != null ? parseFloat(row.tariff2_pos_energy) : null,
        tariff1_neg_energy: row.tariff1_neg_energy != null ? parseFloat(row.tariff1_neg_energy) : null,
        tariff2_neg_energy: row.tariff2_neg_energy != null ? parseFloat(row.tariff2_neg_energy) : null,
        current_tariff: row.current_tariff != null ? parseInt(row.current_tariff) : null,
        phase_a_current: row.phase_a_current != null ? parseFloat(row.phase_a_current) : null,
      }
    })
  }

  async getApplianceHistory(houseId, hours = 24) {
    const sql = hours <= 24
      ? `SELECT appliance_name, active_power, current, voltage, total_active_energy, state, recorded_at
         FROM twin_appliance_data
         WHERE house_id = $1 AND recorded_at >= NOW() - INTERVAL '1 hour' * $2
         ORDER BY recorded_at ASC`
      : `SELECT appliance_name, active_power, current, voltage, total_active_energy, state, recorded_at
         FROM twin_appliance_data
         WHERE house_id = $1 AND recorded_at >= NOW() - INTERVAL '1 hour' * $2
         UNION ALL
         SELECT appliance_name,
                avg_active_power, avg_current, avg_voltage,
                max_total_active_energy, NULL AS state, hour_bucket
         FROM twin_appliance_data_hourly
         WHERE house_id = $1 AND hour_bucket >= NOW() - INTERVAL '1 hour' * $2
           AND hour_bucket < (SELECT COALESCE(MIN(recorded_at), NOW()) FROM twin_appliance_data WHERE house_id = $1)
         ORDER BY recorded_at ASC`

    const result = await query(sql, [houseId, hours])

    // Group by timestamp, one key per appliance
    const applianceSet = new Set()
    const timeMap = new Map()
    for (const row of result.rows) {
      applianceSet.add(row.appliance_name)
      const time = row.recorded_at.toISOString()
      if (!timeMap.has(time)) {
        timeMap.set(time, { time })
      }
      const entry = timeMap.get(time)
      entry[row.appliance_name] = row.active_power != null ? parseFloat(row.active_power) : null
    }

    return {
      appliances: [...applianceSet].sort(),
      data: [...timeMap.values()]
    }
  }

  async getWaterHistory(houseId, hours = 24) {
    const sql = hours <= 24
      ? `SELECT pulse_count, humidity, temperature, recorded_at
         FROM twin_water_data
         WHERE house_id = $1 AND recorded_at >= NOW() - INTERVAL '1 hour' * $2
         ORDER BY recorded_at ASC`
      : `SELECT pulse_count, humidity, temperature, recorded_at
         FROM twin_water_data
         WHERE house_id = $1 AND recorded_at >= NOW() - INTERVAL '1 hour' * $2
         UNION ALL
         SELECT max_pulse_count, avg_humidity, avg_temperature, hour_bucket
         FROM twin_water_data_hourly
         WHERE house_id = $1 AND hour_bucket >= NOW() - INTERVAL '1 hour' * $2
           AND hour_bucket < (SELECT COALESCE(MIN(recorded_at), NOW()) FROM twin_water_data WHERE house_id = $1)
         ORDER BY recorded_at ASC`

    const result = await query(sql, [houseId, hours])
    return result.rows.map(row => ({
      time: row.recorded_at.toISOString(),
      pulse_count: row.pulse_count != null ? parseFloat(row.pulse_count) : null,
      humidity: row.humidity != null ? parseFloat(row.humidity) : null,
      temperature: row.temperature != null ? parseFloat(row.temperature) : null,
    }))
  }

  async getLatestMeterState(houseId) {
    const result = await query(
      `SELECT positive_active_power, negative_active_power, gas_kuub,
              current_tariff, phase_a_current, recorded_at
       FROM twin_meter_data
       WHERE house_id = $1
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [houseId]
    )
    return result.rows[0] || null
  }
}

export default new TwinService()
