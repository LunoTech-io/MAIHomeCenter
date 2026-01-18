import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getQuestionSet, getQuestionSetResponses } from '../../services/api'

function ResponseViewer() {
  const { id } = useParams()
  const [questionSet, setQuestionSet] = useState(null)
  const [responses, setResponses] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [qsData, responseData] = await Promise.all([
        getQuestionSet(id),
        getQuestionSetResponses(id)
      ])
      setQuestionSet(qsData)
      setResponses(responseData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Group responses by assignment/house
  const groupedResponses = () => {
    if (!responses?.responses) return []

    const grouped = {}
    for (const row of responses.responses) {
      if (!grouped[row.assignment_id]) {
        grouped[row.assignment_id] = {
          assignmentId: row.assignment_id,
          houseId: row.house_identifier,
          houseName: row.house_name,
          status: row.status,
          completedAt: row.completed_at,
          answers: {}
        }
      }
      if (row.question_id) {
        grouped[row.assignment_id].answers[row.question_identifier] = {
          questionText: row.question_text,
          questionType: row.question_type,
          value: row.response_value
        }
      }
    }

    return Object.values(grouped)
  }

  if (loading) {
    return (
      <div className="admin">
        <div className="admin-header">
          <h1>Survey Responses</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin">
        <div className="admin-header">
          <h1>Survey Responses</h1>
        </div>
        <div className="result-message error" style={{ position: 'static' }}>{error}</div>
      </div>
    )
  }

  const grouped = groupedResponses()

  return (
    <div className="admin">
      <div className="admin-header">
        <h1>Survey Responses</h1>
        <p>{questionSet?.title}</p>
      </div>

      <div className="admin-section">
        <h2>Summary</h2>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{responses?.summary?.total_count || 0}</span>
            <span className="stat-label">Total Assigned</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{responses?.summary?.completed_count || 0}</span>
            <span className="stat-label">Completed</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{responses?.summary?.pending_count || 0}</span>
            <span className="stat-label">Pending</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{responses?.summary?.dismissed_count || 0}</span>
            <span className="stat-label">Dismissed</span>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <h2>Individual Responses</h2>

        {grouped.length === 0 ? (
          <p className="no-subscribers">No responses yet.</p>
        ) : (
          <div className="responses-list">
            {grouped.map(assignment => (
              <div key={assignment.assignmentId} className="response-card">
                <div className="response-header">
                  <div className="response-house">
                    <strong>{assignment.houseId}</strong>
                    {assignment.houseName && <span> - {assignment.houseName}</span>}
                  </div>
                  <span className={`status-badge status-${assignment.status}`}>
                    {assignment.status}
                  </span>
                </div>

                {assignment.status === 'completed' && (
                  <div className="response-answers">
                    {questionSet?.questions?.map(q => {
                      const answer = assignment.answers[q.identifier]
                      if (q.type === 'display') return null

                      return (
                        <div key={q.id} className="answer-item">
                          <div className="answer-question">{q.question_text}</div>
                          <div className="answer-value">
                            {answer?.value || <em className="no-answer">No answer</em>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {assignment.completedAt && (
                  <div className="response-meta">
                    {new Date(assignment.completedAt).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-actions">
        <Link to="/surveys" className="cancel-btn">Back to Surveys</Link>
      </div>
    </div>
  )
}

export default ResponseViewer
