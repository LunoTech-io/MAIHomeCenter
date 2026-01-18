const API_BASE = import.meta.env.VITE_API_URL || '/api'

export async function getNotificationStats() {
  const response = await fetch(`${API_BASE}/stats`)
  return response.json()
}

export async function broadcastNotification({ title, body, url, icon }) {
  const response = await fetch(`${API_BASE}/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, body, url, icon })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to broadcast notification')
  }

  return response.json()
}

// Survey API

export async function getQuestionSets() {
  const response = await fetch(`${API_BASE}/surveys/question-sets`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch question sets')
  }
  return response.json()
}

export async function getQuestionSet(id) {
  const response = await fetch(`${API_BASE}/surveys/question-sets/${id}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch question set')
  }
  return response.json()
}

export async function createQuestionSet(data) {
  const response = await fetch(`${API_BASE}/surveys/question-sets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create question set')
  }
  return response.json()
}

export async function updateQuestionSet(id, data) {
  const response = await fetch(`${API_BASE}/surveys/question-sets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update question set')
  }
  return response.json()
}

export async function deleteQuestionSet(id) {
  const response = await fetch(`${API_BASE}/surveys/question-sets/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete question set')
  }
  return response.json()
}

export async function getQuestionSetResponses(id) {
  const response = await fetch(`${API_BASE}/surveys/question-sets/${id}/responses`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch responses')
  }
  return response.json()
}

// Houses API

export async function getHouses() {
  const response = await fetch(`${API_BASE}/surveys/houses`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch houses')
  }
  return response.json()
}

export async function createHouse(data) {
  const response = await fetch(`${API_BASE}/surveys/houses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create house')
  }
  return response.json()
}

export async function deleteHouse(id) {
  const response = await fetch(`${API_BASE}/surveys/houses/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete house')
  }
  return response.json()
}

// Send Survey

export async function sendSurvey(questionSetId, houseIds) {
  const response = await fetch(`${API_BASE}/surveys/send-survey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionSetId, houseIds })
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to send survey')
  }
  return response.json()
}
