import { query, getClient } from '../db/index.js'

class SurveyService {
  // Question Set CRUD
  async createQuestionSet(data) {
    const { title, description, notificationTitle, notificationBody, notificationUrl, expiresAt, isDismissable } = data

    // Convert empty string to null for timestamp fields
    const expiresAtValue = expiresAt && expiresAt.trim() !== '' ? expiresAt : null

    const result = await query(
      `INSERT INTO question_sets
       (title, description, notification_title, notification_body, notification_url, expires_at, is_dismissable)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, description, notificationTitle, notificationBody, notificationUrl, expiresAtValue, isDismissable ?? true]
    )

    return result.rows[0]
  }

  async getQuestionSets() {
    const result = await query(
      `SELECT qs.*,
        (SELECT COUNT(*) FROM questions WHERE question_set_id = qs.id) as question_count,
        (SELECT COUNT(*) FROM survey_assignments WHERE question_set_id = qs.id) as assignment_count
       FROM question_sets qs
       ORDER BY created_at DESC`
    )
    return result.rows
  }

  async getQuestionSetById(id) {
    const result = await query(
      'SELECT * FROM question_sets WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  }

  async getQuestionSetWithQuestions(id) {
    const questionSet = await this.getQuestionSetById(id)
    if (!questionSet) return null

    const questions = await query(
      'SELECT * FROM questions WHERE question_set_id = $1 ORDER BY order_index ASC',
      [id]
    )

    return {
      ...questionSet,
      questions: questions.rows
    }
  }

  async updateQuestionSet(id, data) {
    const { title, description, notificationTitle, notificationBody, notificationUrl, expiresAt, isDismissable, isActive } = data

    const result = await query(
      `UPDATE question_sets
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           notification_title = COALESCE($3, notification_title),
           notification_body = COALESCE($4, notification_body),
           notification_url = COALESCE($5, notification_url),
           expires_at = $6,
           is_dismissable = COALESCE($7, is_dismissable),
           is_active = COALESCE($8, is_active)
       WHERE id = $9
       RETURNING *`,
      [title, description, notificationTitle, notificationBody, notificationUrl, expiresAt, isDismissable, isActive, id]
    )

    return result.rows[0]
  }

  async deleteQuestionSet(id) {
    const result = await query('DELETE FROM question_sets WHERE id = $1', [id])
    return result.rowCount > 0
  }

  // Questions CRUD
  async addQuestion(questionSetId, data) {
    const { identifier, type, questionText, options, isRequired, orderIndex } = data

    const result = await query(
      `INSERT INTO questions
       (question_set_id, identifier, type, question_text, options, is_required, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [questionSetId, identifier, type, questionText, options ? JSON.stringify(options) : null, isRequired ?? true, orderIndex ?? 0]
    )

    return result.rows[0]
  }

  async updateQuestion(id, data) {
    const { identifier, type, questionText, options, isRequired, orderIndex } = data

    const result = await query(
      `UPDATE questions
       SET identifier = COALESCE($1, identifier),
           type = COALESCE($2, type),
           question_text = COALESCE($3, question_text),
           options = COALESCE($4, options),
           is_required = COALESCE($5, is_required),
           order_index = COALESCE($6, order_index)
       WHERE id = $7
       RETURNING *`,
      [identifier, type, questionText, options ? JSON.stringify(options) : null, isRequired, orderIndex, id]
    )

    return result.rows[0]
  }

  async deleteQuestion(id) {
    const result = await query('DELETE FROM questions WHERE id = $1', [id])
    return result.rowCount > 0
  }

  async getQuestionsBySetId(questionSetId) {
    const result = await query(
      'SELECT * FROM questions WHERE question_set_id = $1 ORDER BY order_index ASC',
      [questionSetId]
    )
    return result.rows
  }

  // Survey Assignments
  async createAssignment(questionSetId, houseId) {
    const result = await query(
      `INSERT INTO survey_assignments (question_set_id, house_id)
       VALUES ($1, $2)
       ON CONFLICT (question_set_id, house_id) DO NOTHING
       RETURNING *`,
      [questionSetId, houseId]
    )

    return result.rows[0]
  }

  async createBulkAssignments(questionSetId, houseIds) {
    const client = await getClient()

    try {
      await client.query('BEGIN')

      const assignments = []
      for (const houseId of houseIds) {
        const result = await client.query(
          `INSERT INTO survey_assignments (question_set_id, house_id)
           VALUES ($1, $2)
           ON CONFLICT (question_set_id, house_id) DO NOTHING
           RETURNING *`,
          [questionSetId, houseId]
        )
        if (result.rows[0]) {
          assignments.push(result.rows[0])
        }
      }

      await client.query('COMMIT')
      return assignments
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async markNotificationSent(assignmentId) {
    await query(
      'UPDATE survey_assignments SET notification_sent_at = NOW() WHERE id = $1',
      [assignmentId]
    )
  }

  async getPendingSurveys(houseId) {
    const result = await query(
      `SELECT sa.id as assignment_id, sa.status, sa.notification_sent_at, sa.created_at as assigned_at,
              qs.id as question_set_id, qs.title, qs.description, qs.is_dismissable, qs.expires_at
       FROM survey_assignments sa
       JOIN question_sets qs ON sa.question_set_id = qs.id
       WHERE sa.house_id = $1
         AND sa.status = 'pending'
         AND qs.is_active = true
         AND (qs.expires_at IS NULL OR qs.expires_at > NOW())
       ORDER BY sa.created_at DESC`,
      [houseId]
    )
    return result.rows
  }

  async getSurveyForResponse(assignmentId, houseId) {
    const assignmentResult = await query(
      `SELECT sa.*, qs.title, qs.description, qs.is_dismissable
       FROM survey_assignments sa
       JOIN question_sets qs ON sa.question_set_id = qs.id
       WHERE sa.id = $1 AND sa.house_id = $2`,
      [assignmentId, houseId]
    )

    if (assignmentResult.rows.length === 0) {
      return null
    }

    const assignment = assignmentResult.rows[0]
    const questions = await this.getQuestionsBySetId(assignment.question_set_id)

    return {
      ...assignment,
      questions
    }
  }

  // Survey Responses
  async submitResponses(assignmentId, responses) {
    const client = await getClient()

    try {
      await client.query('BEGIN')

      for (const response of responses) {
        await client.query(
          `INSERT INTO survey_responses (assignment_id, question_id, response_value)
           VALUES ($1, $2, $3)
           ON CONFLICT (assignment_id, question_id)
           DO UPDATE SET response_value = $3, created_at = NOW()`,
          [assignmentId, response.questionId, response.value]
        )
      }

      await client.query(
        `UPDATE survey_assignments
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [assignmentId]
      )

      await client.query('COMMIT')
      return true
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async dismissSurvey(assignmentId, houseId) {
    const result = await query(
      `UPDATE survey_assignments
       SET status = 'dismissed', completed_at = NOW()
       WHERE id = $1 AND house_id = $2 AND status = 'pending'
       RETURNING *`,
      [assignmentId, houseId]
    )
    return result.rows[0]
  }

  async getResponsesByQuestionSet(questionSetId) {
    const result = await query(
      `SELECT
         sa.id as assignment_id,
         sa.house_id,
         h.house_id as house_identifier,
         h.name as house_name,
         sa.status,
         sa.completed_at,
         q.id as question_id,
         q.identifier as question_identifier,
         q.question_text,
         q.type as question_type,
         sr.response_value
       FROM survey_assignments sa
       JOIN houses h ON sa.house_id = h.id
       LEFT JOIN survey_responses sr ON sr.assignment_id = sa.id
       LEFT JOIN questions q ON sr.question_id = q.id
       WHERE sa.question_set_id = $1
       ORDER BY sa.completed_at DESC, q.order_index ASC`,
      [questionSetId]
    )
    return result.rows
  }

  async getResponseSummary(questionSetId) {
    const statusResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
         COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
         COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed_count,
         COUNT(*) as total_count
       FROM survey_assignments
       WHERE question_set_id = $1`,
      [questionSetId]
    )

    const responses = await this.getResponsesByQuestionSet(questionSetId)

    return {
      summary: statusResult.rows[0],
      responses
    }
  }
}

export default new SurveyService()
