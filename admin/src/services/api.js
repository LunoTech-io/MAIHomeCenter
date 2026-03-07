const API_BASE = import.meta.env.VITE_API_URL || '/api'

function authHeaders() {
  const token = localStorage.getItem('adminToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Admin Auth API

export async function adminLogin(username, password) {
  const response = await fetch(`${API_BASE}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Login failed')
  }

  return response.json()
}

export async function getAdminMe() {
  const response = await fetch(`${API_BASE}/auth/admin/me`, {
    headers: authHeaders()
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to get admin info')
  }

  return response.json()
}

// Notifications API

export async function getNotificationStats() {
  const response = await fetch(`${API_BASE}/stats`, {
    headers: authHeaders()
  })
  return response.json()
}

export async function broadcastNotification({ title, body, url, icon }) {
  const response = await fetch(`${API_BASE}/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
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
  const response = await fetch(`${API_BASE}/surveys/question-sets`, {
    headers: authHeaders()
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch question sets')
  }
  return response.json()
}

export async function getQuestionSet(id) {
  const response = await fetch(`${API_BASE}/surveys/question-sets/${id}`, {
    headers: authHeaders()
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch question set')
  }
  return response.json()
}

export async function createQuestionSet(data) {
  const response = await fetch(`${API_BASE}/surveys/question-sets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
    method: 'DELETE',
    headers: authHeaders()
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete question set')
  }
  return response.json()
}

export async function getQuestionSetResponses(id) {
  const response = await fetch(`${API_BASE}/surveys/question-sets/${id}/responses`, {
    headers: authHeaders()
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch responses')
  }
  return response.json()
}

// Twin / Sensor API
export async function getSensorHistory(houseId, hours = 24) {
  const response = await fetch(`${API_BASE}/twin/sensor-data/${houseId}/grouped?hours=${hours}`, {
    headers: authHeaders()
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch sensor history')
  }

  return response.json()
}

export async function getMeterHistory(houseId, hours = 24) {
  const response = await fetch(`${API_BASE}/twin/meter-data/${houseId}?hours=${hours}`, {
    headers: authHeaders()
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch meter history')
  }

  return response.json()
}

export async function getApplianceHistory(houseId, hours = 24) {
  const response = await fetch(`${API_BASE}/twin/appliance-data/${houseId}?hours=${hours}`, {
    headers: authHeaders()
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch appliance history')
  }

  return response.json()
}

export async function getTwinState(houseId) {
  const response = await fetch(`${API_BASE}/twin/state/${houseId}`, {
    headers: authHeaders()
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch twin state')
  }

  return response.json()
}

// Twin Predictions API
export async function getLatestPrediction(houseId) {
  const response = await fetch(`${API_BASE}/twin/predictions/${houseId}/latest`, {
    headers: authHeaders()
  })
  if (response.status === 404) return null
  if (!response.ok) return null
  return response.json()
}

// Houses API

export async function getHouses() {
  const response = await fetch(`${API_BASE}/surveys/houses`, {
    headers: authHeaders()
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch houses')
  }
  return response.json()
}

export async function createHouse(data) {
  const response = await fetch(`${API_BASE}/surveys/houses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
    method: 'DELETE',
    headers: authHeaders()
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete house')
  }
  return response.json()
}

// Alert Rules API

export async function getAlertRules() {
  const response = await fetch(`${API_BASE}/alerts/rules`, {
    headers: authHeaders()
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch alert rules')
  }
  return response.json()
}

export async function getAlertRule(id) {
  const response = await fetch(`${API_BASE}/alerts/rules/${id}`, {
    headers: authHeaders()
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch alert rule')
  }
  return response.json()
}

export async function createAlertRule(data) {
  const response = await fetch(`${API_BASE}/alerts/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create alert rule')
  }
  return response.json()
}

export async function updateAlertRule(id, data) {
  const response = await fetch(`${API_BASE}/alerts/rules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update alert rule')
  }
  return response.json()
}

export async function deleteAlertRule(id) {
  const response = await fetch(`${API_BASE}/alerts/rules/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete alert rule')
  }
  return response.json()
}

// Send Survey

export async function sendSurvey(questionSetId, houseIds) {
  const response = await fetch(`${API_BASE}/surveys/send-survey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ questionSetId, houseIds })
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to send survey')
  }
  return response.json()
}
