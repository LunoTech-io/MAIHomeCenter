export const ROOM_TYPES = ['default', 'living', 'bedroom', 'bathroom', 'kitchen', 'hallway']

export function getRoomType(roomName) {
  if (!roomName) return 'default'
  const n = String(roomName).toLowerCase()
  if (n.startsWith('living') || n.startsWith('dining')) return 'living'
  if (n.startsWith('bedroom') || n.startsWith('slaapkamer')) return 'bedroom'
  if (n.startsWith('bathroom') || n.startsWith('badkamer')) return 'bathroom'
  if (n.startsWith('kitchen') || n.startsWith('keuken')) return 'kitchen'
  if (n.includes('hall') || n.includes('hal')) return 'hallway'
  return 'default'
}

// Accept either the new {default, living, bedroom, ...} shape or the pre-migration
// flat {temperature, humidity, co2} shape. Always returns the new shape.
export function normalizeThresholds(data) {
  if (!data) return null
  if (data.default) return data
  if (data.temperature || data.humidity || data.co2) return { default: data }
  return data
}

export function getEffectiveThresholds(thresholds, roomType) {
  const def = thresholds?.default || {}
  const ov = thresholds?.[roomType] || {}
  return {
    temperature: { ...(def.temperature || {}), ...(ov.temperature || {}) },
    humidity:    { ...(def.humidity    || {}), ...(ov.humidity    || {}) },
    co2:         { ...(def.co2         || {}), ...(ov.co2         || {}) },
  }
}
