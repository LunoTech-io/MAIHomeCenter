import { query } from '../db/index.js'
import surveyService from './surveyService.js'
import pushService from './pushService.js'

const ALLOWED_SENSOR_FIELDS = ['temperature', 'humidity', 'co2', 'tvoc', 'pressure', 'light_level']
const ALLOWED_OPERATORS = ['above', 'below']

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

function violatesThreshold(value, operator, threshold) {
  if (operator === 'above') return value > threshold
  if (operator === 'below') return value < threshold
  return false
}

// =====================
// CRUD
// =====================

async function getTriggersByOrganization(organization) {
  const result = await query(
    `SELECT st.*, qs.title AS question_set_title
     FROM survey_triggers st
     JOIN question_sets qs ON qs.id = st.question_set_id
     ORDER BY st.created_at DESC`
  )
  return result.rows.filter(r => r.organization === organization)
}

async function getTriggerById(id) {
  const result = await query('SELECT * FROM survey_triggers WHERE id = $1', [id])
  return result.rows[0] || null
}

async function getTriggerByQuestionSetId(questionSetId) {
  const result = await query(
    'SELECT * FROM survey_triggers WHERE question_set_id = $1',
    [questionSetId]
  )
  return result.rows[0] || null
}

async function createTrigger({ questionSetId, organization, conditions, sustainedMinutes, isActive, createdBy }) {
  validateConditions(conditions)

  const result = await query(
    `INSERT INTO survey_triggers (question_set_id, organization, conditions, sustained_minutes, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [questionSetId, organization, JSON.stringify(conditions), sustainedMinutes ?? 0, isActive ?? true, createdBy]
  )
  return result.rows[0]
}

async function updateTrigger(id, { conditions, sustainedMinutes, isActive }) {
  if (conditions) {
    validateConditions(conditions)
  }

  const result = await query(
    `UPDATE survey_triggers
     SET conditions = COALESCE($2, conditions),
         sustained_minutes = COALESCE($3, sustained_minutes),
         is_active = COALESCE($4, is_active),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, conditions ? JSON.stringify(conditions) : null, sustainedMinutes, isActive]
  )
  return result.rows[0] || null
}

async function deleteTrigger(id) {
  const result = await query('DELETE FROM survey_triggers WHERE id = $1 RETURNING id', [id])
  return result.rowCount > 0
}

// =====================
// Evaluation engine
// =====================

async function evaluateTriggers() {
  const triggersResult = await query(
    'SELECT * FROM survey_triggers WHERE is_active = TRUE'
  )
  const triggers = triggersResult.rows

  if (triggers.length === 0) return

  for (const trigger of triggers) {
    try {
      await evaluateTrigger(trigger)
    } catch (err) {
      console.error(`[survey-triggers] error evaluating trigger for question_set ${trigger.question_set_id}:`, err.message)
    }
  }
}

async function evaluateTrigger(trigger) {
  const housesResult = await query(
    'SELECT id, house_id FROM houses WHERE organization = $1',
    [trigger.organization]
  )
  const houses = housesResult.rows

  if (houses.length === 0) return

  const conditions = trigger.conditions
  if (!Array.isArray(conditions) || conditions.length === 0) return

  for (const c of conditions) {
    if (!ALLOWED_SENSOR_FIELDS.includes(c.sensorField)) return
  }

  for (const house of houses) {
    try {
      await evaluateTriggerForHouse(trigger, house)
    } catch (err) {
      console.error(`[survey-triggers] error for house ${house.house_id}:`, err.message)
    }
  }
}

async function evaluateTriggerForHouse(trigger, house) {
  const windowMinutes = trigger.sustained_minutes || 1
  const conditions = trigger.conditions

  const sensorFields = [...new Set(conditions.map(c => c.sensorField))]
  const fieldSelects = sensorFields.join(', ')
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

  // Get current trigger state for this trigger+house
  const stateResult = await query(
    'SELECT * FROM survey_trigger_state WHERE trigger_id = $1 AND house_id = $2',
    [trigger.id, house.house_id]
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
      if (trigger.sustained_minutes === 0) {
        const latest = readings[0]
        conditionMet = conditions.every(c =>
          latest[c.sensorField] != null &&
          violatesThreshold(parseFloat(latest[c.sensorField]), c.operator, parseFloat(c.threshold))
        )
      } else {
        conditionMet = readings.length >= 2 && readings.every(row =>
          conditions.every(c =>
            row[c.sensorField] != null &&
            violatesThreshold(parseFloat(row[c.sensorField]), c.operator, parseFloat(c.threshold))
          )
        )
      }
    }

    if (conditionMet && (!state || state.status === 'resolved')) {
      // TRIGGER — send the survey to this house
      await query(
        `INSERT INTO survey_trigger_state (trigger_id, house_id, room_name, status, triggered_at)
         VALUES ($1, $2, $3, 'triggered', NOW())
         ON CONFLICT (trigger_id, house_id, room_name)
         DO UPDATE SET status = 'triggered', triggered_at = NOW(), resolved_at = NULL`,
        [trigger.id, house.house_id, roomName]
      )

      // Create survey assignment for this house
      const assignments = await surveyService.createBulkAssignments(trigger.question_set_id, [house.id])

      if (assignments.length > 0) {
        // Get question set for notification content
        const questionSet = await surveyService.getQuestionSetById(trigger.question_set_id)

        if (questionSet) {
          const notificationResults = await pushService.sendToHouses([house.id], {
            title: questionSet.notification_title,
            body: questionSet.notification_body,
            url: questionSet.notification_url || '/surveys',
            data: { type: 'survey', questionSetId: trigger.question_set_id }
          })

          for (const assignment of assignments) {
            if (notificationResults.sentHouses.includes(assignment.house_id)) {
              await surveyService.markNotificationSent(assignment.id)
            }
          }
        }
      }

      console.log(`[survey-triggers] TRIGGERED survey for question_set=${trigger.question_set_id} — house=${house.house_id} room="${roomName}"`)
    } else if (!conditionMet && state && state.status === 'triggered') {
      // RESOLVE — condition no longer met, allow re-triggering in the future
      await query(
        `UPDATE survey_trigger_state
         SET status = 'resolved', resolved_at = NOW()
         WHERE trigger_id = $1 AND house_id = $2 AND room_name = $3`,
        [trigger.id, house.house_id, roomName]
      )

      console.log(`[survey-triggers] RESOLVED trigger for question_set=${trigger.question_set_id} — house=${house.house_id} room="${roomName}"`)
    }
  }
}

export default {
  getTriggersByOrganization,
  getTriggerById,
  getTriggerByQuestionSetId,
  createTrigger,
  updateTrigger,
  deleteTrigger,
  evaluateTriggers
}
