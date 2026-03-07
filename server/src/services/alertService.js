import { query } from '../db/index.js'
import pushService from './pushService.js'

const ALLOWED_SENSOR_FIELDS = ['temperature', 'humidity', 'co2', 'tvoc', 'pressure', 'light_level']
const ALLOWED_OPERATORS = ['above', 'below']
const EVAL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const STARTUP_DELAY_MS = 15_000

let intervalId = null
let isEvaluating = false

// =====================
// Validation
// =====================

function validateConditions(conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new Error('At least one condition is required')
  }
  for (const c of conditions) {
    if (!ALLOWED_SENSOR_FIELDS.includes(c.sensorField)) {
      throw new Error(`Invalid sensor field: ${c.sensorField}`)
    }
    if (!ALLOWED_OPERATORS.includes(c.operator)) {
      throw new Error(`Invalid operator: ${c.operator}`)
    }
    if (c.threshold == null || isNaN(Number(c.threshold))) {
      throw new Error('Each condition must have a numeric threshold')
    }
  }
}

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

async function createRule({ organization, name, conditions, sustainedMinutes, notificationTitle, notificationBody, isActive, createdBy }) {
  validateConditions(conditions)

  const result = await query(
    `INSERT INTO alert_rules (organization, name, conditions, sustained_minutes, notification_title, notification_body, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [organization, name, JSON.stringify(conditions), sustainedMinutes ?? 0, notificationTitle, notificationBody, isActive ?? true, createdBy]
  )
  return result.rows[0]
}

async function updateRule(id, { name, conditions, sustainedMinutes, notificationTitle, notificationBody, isActive }) {
  if (conditions) {
    validateConditions(conditions)
  }

  const result = await query(
    `UPDATE alert_rules
     SET name = COALESCE($2, name),
         conditions = COALESCE($3, conditions),
         sustained_minutes = COALESCE($4, sustained_minutes),
         notification_title = COALESCE($5, notification_title),
         notification_body = COALESCE($6, notification_body),
         is_active = COALESCE($7, is_active),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, name, conditions ? JSON.stringify(conditions) : null, sustainedMinutes, notificationTitle, notificationBody, isActive]
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
  const housesResult = await query(
    'SELECT id, house_id FROM houses WHERE organization = $1',
    [rule.organization]
  )
  const houses = housesResult.rows

  if (houses.length === 0) return

  const conditions = rule.conditions
  if (!Array.isArray(conditions) || conditions.length === 0) return

  // Validate all sensor fields against allowlist (defense in depth)
  for (const c of conditions) {
    if (!ALLOWED_SENSOR_FIELDS.includes(c.sensorField)) return
  }

  for (const house of houses) {
    try {
      await evaluateRuleForHouse(rule, house)
    } catch (err) {
      console.error(`[alerts] error evaluating rule "${rule.name}" for house ${house.house_id}:`, err.message)
    }
  }
}

async function evaluateRuleForHouse(rule, house) {
  const windowMinutes = rule.sustained_minutes || 1
  const conditions = rule.conditions

  // Collect the unique sensor fields we need to query
  const sensorFields = [...new Set(conditions.map(c => c.sensorField))]

  // Build SELECT for all needed fields in one query
  const fieldSelects = sensorFields.map(f => f).join(', ')
  const fieldNotNullClauses = sensorFields.map(f => `${f} IS NOT NULL`).join(' OR ')

  const dataResult = await query(
    `SELECT room_name, ${fieldSelects}, recorded_at
     FROM twin_sensor_data
     WHERE house_id = $1
       AND recorded_at >= NOW() - INTERVAL '${windowMinutes} minutes'
       AND (${fieldNotNullClauses})
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

  const allRoomNames = new Set([...Object.keys(roomReadings), ...Object.keys(stateByRoom)])

  for (const roomName of allRoomNames) {
    const readings = roomReadings[roomName] || []
    const state = stateByRoom[roomName]
    let conditionMet = false

    if (readings.length > 0) {
      if (rule.sustained_minutes === 0) {
        // Instant: latest reading must violate ALL conditions
        const latest = readings[0]
        conditionMet = conditions.every(c =>
          latest[c.sensorField] != null &&
          violatesThreshold(parseFloat(latest[c.sensorField]), c.operator, parseFloat(c.threshold))
        )
      } else {
        // Sustained: need >= 2 readings and ALL readings must violate ALL conditions
        conditionMet = readings.length >= 2 && readings.every(row =>
          conditions.every(c =>
            row[c.sensorField] != null &&
            violatesThreshold(parseFloat(row[c.sensorField]), c.operator, parseFloat(c.threshold))
          )
        )
      }
    }

    if (conditionMet && (!state || state.status === 'resolved')) {
      // TRIGGER — build notification with first condition's latest value for {value}
      const latestValue = readings[0][conditions[0].sensorField]
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

      await pushService.sendToHouses([house.id], {
        title,
        body,
        data: { type: 'alert', ruleId: rule.id }
      })

      console.log(`[alerts] TRIGGERED rule "${rule.name}" — house=${house.house_id} room="${roomName}"`)
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
