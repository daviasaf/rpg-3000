import { getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { requireRoomAccess } from '../../../utils/permissions'
import { activePresenceForRoom } from '../../../utils/presence'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'id') || ''
  await requireRoomAccess(roomId, user.id)

  return { online: activePresenceForRoom(roomId) }
})

