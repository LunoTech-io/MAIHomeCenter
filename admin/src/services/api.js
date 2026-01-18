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
