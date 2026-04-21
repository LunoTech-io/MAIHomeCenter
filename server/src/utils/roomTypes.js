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

export function matchesRoomTypes(roomName, roomTypes) {
  if (!Array.isArray(roomTypes) || roomTypes.length === 0) return true
  return roomTypes.includes(getRoomType(roomName))
}
