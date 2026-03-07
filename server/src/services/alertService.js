import { query } from '../db/index.js'
import pushService from './pushService.js'

const ALLOWED_SENSOR_FIELDS = ['temperature', 'humidity', 'co2', 'tvoc', 'pressure', 'light_level']
const ALLOWED_OPERATORS = ['above', 'below']
const EVAL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const STARTUP_DELAY_MS = 15_000

let intervalId = null
let isEvaluating = false

// =====================
// CRUD
// =====================

async function getRulesByOrganization(organization) {
  const result = await query(
    'SELECT * FROM alert_rules WHERE organization = $1 ORDER BY created_at DESC',
    [organization]
  )
  return result.rows
}

async function getRuleById(id) {
  const result = await query('SELECT * FROM alert_rules WHERE id = $1', [id])
  return result.rows[0] || null
}

async function createRule({ organization, name, sensorField, operator, threshold, sustainedMinutes, notificationTitle, notificationBody, isActive, createdBy }) {
  if (!ALLOWED_SENSOR_FIELDS.includes(sensorField)) {
    throw new Error(`Invalid sensor field: ${sensorField}`)
  }
  if (!ALLOWED_OPERATORS.includes(operator)) {
    throw new Error(`Invalid operator: ${operator}`)
  }

  const result = await query(
    `INSERT INTO alert_rules (organization, name, sensor_field, operator, threshold, sustained_minutes, notification_title, notification_body, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [organization, name, sensorField, operator, threshold, sustainedMinutes ?? 0, notificationTitle, notificationBody, isActive ?? true, createdBy]
  )
  return result.rows[0]
}

async function updateRule(id, { name, sensorField, operator, threshold, sustainedMinutes, notificationTitle, notificationBody, isActive }) {
  if (sensorField && !ALLOWED_SENSOR_FIELDS.includes(sensorField)) {
    throw new Error(`Invalid sensor field: ${sensorField}`)
  }
  if (operator && !ALLOWED_OPERATORS.includes(operator)) {
    throw new Error(`Invalid operator: ${operator}`)
  }

  const result = await query(
    `UPDATE alert_rules
     SET name = COALESCE($2, name),
         sensor_field = COALESCE($3, sensor_field),
         operator = COALESCE($4, operator),
         threshold = COALESCE($5, threshold),
         sustained_minutes = COALESCE($6, sustained_minutes),
         notification_title = COALESCE($7, notification_title),
         notification_body = COALESCE($8, notification_body),
         is_active = COALESCE($9, is_active),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, name, sensorField, operator, threshold, sustainedMinutes, notificationTitle, notificationBody, isActive]
  )
  return result.rows[0] || null
}

async function deleteRule(id) {
  const result = await query('DELETE FROM alert_rules WHERE id = $1 RETURNING id', [id])
  return result.rowCount > 0
}

// =====================
// Evaluation engine
// =====================

function violatesThreshold(value, operator, threshold) {
  if (operator === 'above') return value > threshold
  if (operator === 'below') return value < threshold
  return false
}

async function evaluateRules() {
  if (isEvaluating) {
    console.log('[alerts] skipping — previous evaluation still running')
    return
  }

  isEvaluating = true
  const start = Date.now()

  try {
    const rulesResult = await query(
      'SELECT * FROM alert_rules WHERE is_active = TRUE'
    )
    const rules = rulesResult.rows

    if (rules.length === 0) return

    for (const rule of rules) {
      try {
        await evaluateRule(rule)
      } catch (err) {
        console.error(`[alerts] error evaluating rule "${rule.name}" (${rule.id}):`, err.message)
      }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`[alerts] evaluation completed in ${elapsed}s — ${rules.length} rules checked`)
  } catch (err) {
    console.error('[alerts] evaluation failed:', err)
  } finally {
    isEvaluating = false
  }
}

async function evaluateRule(rule) {
  // Get houses for this rule's organization (need both id UUID and house_id VARCHAR)
  const housesResult = await query(
    'SELECT id, house_id FROM houses WHERE organization = $1',
    [rule.organization]
  )
  const houses = housesResult.rows

  if (houses.length === 0) return

  // Validate sensor_field against allowed list (defense in depth)
  if (!ALLOWED_SENSOR_FIELDS.includes(rule.sensor_field)) return

  for (const house of houses) {
    try {
      await evaluateRuleForHouse(rule, house)
    } catch (err) {
      console.error(`[alerts] error evaluating rule "${rule.name}" for house ${house.house_id}:`, err.message)
    }
  }
}

async function evaluateRuleForHouse(rule, house) {
  const windowMinutes = rule.sustained_minutes || 1 // at least 1 minute window for instant
  const sensorField = rule.sensor_field // already validated against allowlist

  // Query sensor readings within the sustained window, grouped by room
  const dataResult = await query(
    `SELECT room_name, ${sensorField} as value, recorded_at
     FROM twin_sensor_data
     WHERE house_id = $1
       AND recorded_at >= NOW() - INTERVAL '${windowMinutes} minutes'
       AND ${sensorField} IS NOT NULL
     ORDER BY room_name, recorded_at DESC`,
    [house.house_id]
  )

  // Group readings by room
  const roomReadings = {}
  for (const row of dataResult.rows) {
    if (!roomReadings[row.room_name]) {
      roomReadings[row.room_name] = []
    }
    roomReadings[row.room_name].push(row)
  }

  // Get current state for all rooms for this rule+house
  const stateResult = await query(
    'SELECT * FROM alert_rule_state WHERE rule_id = $1 AND house_id = $2',
    [rule.id, house.house_id]
  )
  const stateByRoom = {}
  for (const row of stateResult.rows) {
    stateByRoom[row.room_name] = row
  }

  // Check each room that has state (for resolving triggered rooms with no recent data)
  const allRoomNames = new Set([...Object.keys(roomReadings), ...Object.keys(stateByRoom)])

  for (const roomName of allRoomNames) {
    const readings = roomReadings[roomName] || []
    const state = stateByRoom[roomName]
    let conditionMet = false

    if (readings.length > 0) {
      if (rule.sustained_minutes === 0) {
        // Instant: just check the latest reading
        conditionMet = violatesThreshold(parseFloat(readings[0].value), rule.operator, parseFloat(rule.threshold))
      } else {
        // Sustained: need >= 2 readings and ALL must violate
        conditionMet = readings.length >= 2 &&
          readings.every(r => violatesThreshold(parseFloat(r.value), rule.operator, parseFloat(rule.threshold)))
      }
    }

    if (conditionMet && (!state || state.status === 'resolved')) {
      // TRIGGER
      const latestValue = readings[0].value
      const title = rule.notification_title
        .replace(/\{room\}/g, roomName)
        .replace(/\{value\}/g, latestValue)
      const body = rule.notification_body
        .replace(/\{room\}/g, roomName)
        .replace(/\{value\}/g, latestValue)

      await query(
        `INSERT INTO alert_rule_state (rule_id, house_id, room_name, status, triggered_at, last_notified_at)
         VALUES ($1, $2, $3, 'triggered', NOW(), NOW())
         ON CONFLICT (rule_id, house_id, room_name)
         DO UPDATE SET status = 'triggered', triggered_at = NOW(), resolved_at = NULL, last_notified_at = NOW()`,
        [rule.id, house.house_id, roomName]
      )

      // Send push notification (uses house UUID for subscriptions)
      await pushService.sendToHouses([house.id], {
        title,
        body,
        data: { type: 'alert', ruleId: rule.id }
      })

      console.log(`[alerts] TRIGGERED rule "${rule.name}" — house=${house.house_id} room="${roomName}" value=${latestValue}`)
    } else if (!conditionMet && state && state.status === 'triggered') {
      // RESOLVE
      await query(
        `UPDATE alert_rule_state
         SET status = 'resolved', resolved_at = NOW()
         WHERE rule_id = $1 AND house_id = $2 AND room_name = $3`,
        [rule.id, house.house_id, roomName]
      )

      console.log(`[alerts] RESOLVED rule "${rule.name}" — house=${house.house_id} room="${roomName}"`)
    }
  }
}

// =====================
// Cron
// =====================

export function startAlertCron() {
  console.log('[alerts] cron started — evaluates every 5 minutes')
  setTimeout(() => evaluateRules(), STARTUP_DELAY_MS)
  intervalId = setInterval(() => evaluateRules(), EVAL_INTERVAL_MS)
}

export function stopAlertCron() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[alerts] cron stopped')
  }
}

export default {
  getRulesByOrganization,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  evaluateRules,
  startAlertCron,
  stopAlertCron,
  ALLOWED_SENSOR_FIELDS,
  ALLOWED_OPERATORS
}
