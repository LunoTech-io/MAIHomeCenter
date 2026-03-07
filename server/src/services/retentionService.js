import { getClient } from '../db/index.js'

const FULL_RES_HOURS = 24
const HOURLY_RETENTION_DAYS = 90

class RetentionService {
  async runRetention() {
    const start = Date.now()
    const client = await getClient()

    try {
      await client.query('BEGIN')

      // --- 1. Aggregate then delete full-res data older than 24h ---

      // Room sensor data
      await client.query(`
        INSERT INTO twin_sensor_data_hourly
          (house_id, room_name, hour_bucket,
           avg_temperature, avg_temperature_set, max_pir,
           avg_humidity, avg_co2, avg_light_level, avg_pressure, avg_tvoc,
           avg_valve_position, max_door_status, sample_count)
        SELECT
          house_id, room_name, date_trunc('hour', recorded_at),
          AVG(temperature), AVG(temperature_set), MAX(pir),
          AVG(humidity), AVG(co2), AVG(light_level), AVG(pressure), AVG(tvoc),
          AVG(valve_position), MAX(door_status), COUNT(*)
        FROM twin_sensor_data
        WHERE recorded_at < NOW() - INTERVAL '${FULL_RES_HOURS} hours'
        GROUP BY house_id, room_name, date_trunc('hour', recorded_at)
        ON CONFLICT (house_id, room_name, hour_bucket)
        DO UPDATE SET
          avg_temperature     = EXCLUDED.avg_temperature,
          avg_temperature_set = EXCLUDED.avg_temperature_set,
          max_pir             = EXCLUDED.max_pir,
          avg_humidity        = EXCLUDED.avg_humidity,
          avg_co2             = EXCLUDED.avg_co2,
          avg_light_level     = EXCLUDED.avg_light_level,
          avg_pressure        = EXCLUDED.avg_pressure,
          avg_tvoc            = EXCLUDED.avg_tvoc,
          avg_valve_position  = EXCLUDED.avg_valve_position,
          max_door_status     = EXCLUDED.max_door_status,
          sample_count        = EXCLUDED.sample_count
      `)
      const sensorDel = await client.query(
        `DELETE FROM twin_sensor_data WHERE recorded_at < NOW() - INTERVAL '${FULL_RES_HOURS} hours'`
      )

      // Meter data
      await client.query(`
        INSERT INTO twin_meter_data_hourly
          (house_id, hour_bucket,
           avg_positive_active_power, avg_negative_active_power, max_gas_kuub,
           max_tariff1_pos_energy, max_tariff2_pos_energy,
           max_tariff1_neg_energy, max_tariff2_neg_energy,
           last_current_tariff, avg_phase_a_current, sample_count)
        SELECT
          house_id, date_trunc('hour', recorded_at),
          AVG(positive_active_power), AVG(negative_active_power), MAX(gas_kuub),
          MAX(tariff1_pos_energy), MAX(tariff2_pos_energy),
          MAX(tariff1_neg_energy), MAX(tariff2_neg_energy),
          MAX(current_tariff), AVG(phase_a_current), COUNT(*)
        FROM twin_meter_data
        WHERE recorded_at < NOW() - INTERVAL '${FULL_RES_HOURS} hours'
        GROUP BY house_id, date_trunc('hour', recorded_at)
        ON CONFLICT (house_id, hour_bucket)
        DO UPDATE SET
          avg_positive_active_power = EXCLUDED.avg_positive_active_power,
          avg_negative_active_power = EXCLUDED.avg_negative_active_power,
          max_gas_kuub              = EXCLUDED.max_gas_kuub,
          max_tariff1_pos_energy    = EXCLUDED.max_tariff1_pos_energy,
          max_tariff2_pos_energy    = EXCLUDED.max_tariff2_pos_energy,
          max_tariff1_neg_energy    = EXCLUDED.max_tariff1_neg_energy,
          max_tariff2_neg_energy    = EXCLUDED.max_tariff2_neg_energy,
          last_current_tariff       = EXCLUDED.last_current_tariff,
          avg_phase_a_current       = EXCLUDED.avg_phase_a_current,
          sample_count              = EXCLUDED.sample_count
      `)
      const meterDel = await client.query(
        `DELETE FROM twin_meter_data WHERE recorded_at < NOW() - INTERVAL '${FULL_RES_HOURS} hours'`
      )

      // Appliance data
      await client.query(`
        INSERT INTO twin_appliance_data_hourly
          (house_id, appliance_name, hour_bucket,
           avg_active_power, avg_current, avg_voltage,
           max_total_active_energy, sample_count)
        SELECT
          house_id, appliance_name, date_trunc('hour', recorded_at),
          AVG(active_power), AVG(current), AVG(voltage),
          MAX(total_active_energy), COUNT(*)
        FROM twin_appliance_data
        WHERE recorded_at < NOW() - INTERVAL '${FULL_RES_HOURS} hours'
        GROUP BY house_id, appliance_name, date_trunc('hour', recorded_at)
        ON CONFLICT (house_id, appliance_name, hour_bucket)
        DO UPDATE SET
          avg_active_power        = EXCLUDED.avg_active_power,
          avg_current             = EXCLUDED.avg_current,
          avg_voltage             = EXCLUDED.avg_voltage,
          max_total_active_energy = EXCLUDED.max_total_active_energy,
          sample_count            = EXCLUDED.sample_count
      `)
      const appDel = await client.query(
        `DELETE FROM twin_appliance_data WHERE recorded_at < NOW() - INTERVAL '${FULL_RES_HOURS} hours'`
      )

      // Water data
      await client.query(`
        INSERT INTO twin_water_data_hourly
          (house_id, hour_bucket,
           max_pulse_count, avg_humidity, avg_temperature, sample_count)
        SELECT
          house_id, date_trunc('hour', recorded_at),
          MAX(pulse_count), AVG(humidity), AVG(temperature), COUNT(*)
        FROM twin_water_data
        WHERE recorded_at < NOW() - INTERVAL '${FULL_RES_HOURS} hours'
        GROUP BY house_id, date_trunc('hour', recorded_at)
        ON CONFLICT (house_id, hour_bucket)
        DO UPDATE SET
          max_pulse_count = EXCLUDED.max_pulse_count,
          avg_humidity    = EXCLUDED.avg_humidity,
          avg_temperature = EXCLUDED.avg_temperature,
          sample_count    = EXCLUDED.sample_count
      `)
      const waterDel = await client.query(
        `DELETE FROM twin_water_data WHERE recorded_at < NOW() - INTERVAL '${FULL_RES_HOURS} hours'`
      )

      // Predictions — just delete old ones (no aggregation needed)
      const predDel = await client.query(
        `DELETE FROM twin_predictions WHERE predicted_at < NOW() - INTERVAL '${HOURLY_RETENTION_DAYS} days'`
      )

      // --- 2. Purge hourly aggregates older than 90 days ---

      await client.query(
        `DELETE FROM twin_sensor_data_hourly WHERE hour_bucket < NOW() - INTERVAL '${HOURLY_RETENTION_DAYS} days'`
      )
      await client.query(
        `DELETE FROM twin_meter_data_hourly WHERE hour_bucket < NOW() - INTERVAL '${HOURLY_RETENTION_DAYS} days'`
      )
      await client.query(
        `DELETE FROM twin_appliance_data_hourly WHERE hour_bucket < NOW() - INTERVAL '${HOURLY_RETENTION_DAYS} days'`
      )
      await client.query(
        `DELETE FROM twin_water_data_hourly WHERE hour_bucket < NOW() - INTERVAL '${HOURLY_RETENTION_DAYS} days'`
      )

      await client.query('COMMIT')

      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      console.log(
        `[retention] completed in ${elapsed}s — deleted: ` +
        `sensor=${sensorDel.rowCount}, meter=${meterDel.rowCount}, ` +
        `appliance=${appDel.rowCount}, water=${waterDel.rowCount}, ` +
        `predictions=${predDel.rowCount}`
      )
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('[retention] failed:', error)
    } finally {
      client.release()
    }
  }
}

const retentionService = new RetentionService()

let intervalId = null

export function startRetentionCron() {
  // Run every hour
  const ONE_HOUR = 60 * 60 * 1000
  console.log('[retention] cron started — runs every hour, keeps 24h full-res, 90d hourly')

  // Run once on startup (after a short delay to let DB settle)
  setTimeout(() => retentionService.runRetention(), 10_000)

  intervalId = setInterval(() => retentionService.runRetention(), ONE_HOUR)
}

export function stopRetentionCron() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[retention] cron stopped')
  }
}

export default retentionService
