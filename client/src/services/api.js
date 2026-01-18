const API_BASE = import.meta.env.VITE_API_URL || '/api'

export async function getVapidPublicKey() {
  const response = await fetch(`${API_BASE}/vapid-public-key`)
  if (!response.ok) {
    throw new Error('Failed to get VAPID public key')
  }
  const data = await response.json()
  return data.publicKey
}

export async function subscribeToNotifications(subscription) {
  const response = await fetch(`${API_BASE}/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(subscription)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to subscribe')
  }

  return response.json()
}

export async function unsubscribeFromNotifications(endpoint) {
  const response = await fetch(`${API_BASE}/unsubscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ endpoint })
  })

  return response.json()
}

export async function sendTestNotification(subscription) {
  const response = await fetch(`${API_BASE}/test-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ subscription })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to send test notification')
  }

  return response.json()
}

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

// Helper: Convert VAPID key from base64 to Uint8Array
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}
