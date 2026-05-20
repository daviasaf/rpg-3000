type PresenceEntry = {
  roomId: string
  userId: string
  name: string
  online: boolean
  lastSeen: number
}

const staleAfterMs = 18000
const presenceStore = globalThis as typeof globalThis & {
  __centralRpgPresence?: Map<string, PresenceEntry>
}

export const roomPresence = presenceStore.__centralRpgPresence || new Map<string, PresenceEntry>()
presenceStore.__centralRpgPresence = roomPresence

export function presenceKey(roomId: string, userId: string) {
  return `${roomId}:${userId}`
}

export function setRoomPresence(roomId: string, userId: string, name: string, online: boolean) {
  const key = presenceKey(roomId, userId)
  const previous = roomPresence.get(key)
  const now = Date.now()
  const wasOnline = Boolean(previous?.online && now - previous.lastSeen < staleAfterMs)
  const next: PresenceEntry = {
    roomId,
    userId,
    name,
    online,
    lastSeen: now
  }

  roomPresence.set(key, next)

  return {
    previous,
    next,
    changed: wasOnline !== online
  }
}

export function activePresenceForRoom(roomId: string) {
  const now = Date.now()
  return [...roomPresence.values()]
    .filter((entry) => entry.roomId === roomId && entry.online && now - entry.lastSeen < staleAfterMs)
    .map((entry) => ({
      userId: entry.userId,
      name: entry.name,
      lastSeen: new Date(entry.lastSeen).toISOString()
    }))
}
