import { query } from '../db/index.js'

export const EVENT_SURVEY_OPENED = 'survey_opened'
export const EVENT_SURVEY_COMPLETED = 'survey_completed'

const EVENT_POINTS = {
  [EVENT_SURVEY_OPENED]: 1,
  [EVENT_SURVEY_COMPLETED]: 3,
}

async function awardPoints({ houseId, eventType, assignmentId = null }) {
  const points = EVENT_POINTS[eventType]
  if (points == null) throw new Error(`Unknown point event type: ${eventType}`)

  const result = await query(
    `INSERT INTO house_point_events (house_id, event_type, points, assignment_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (house_id, event_type, assignment_id) DO NOTHING
     RETURNING id`,
    [houseId, eventType, points, assignmentId]
  )
  return result.rowCount > 0
}

async function getPointsForHouse(houseId) {
  const result = await query(
    `SELECT COALESCE(SUM(points), 0)::int AS total
     FROM house_point_events
     WHERE house_id = $1`,
    [houseId]
  )
  return result.rows[0].total
}

export default {
  awardPoints,
  getPointsForHouse,
  EVENT_SURVEY_OPENED,
  EVENT_SURVEY_COMPLETED,
}
