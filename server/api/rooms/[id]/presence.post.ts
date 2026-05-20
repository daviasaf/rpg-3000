import { getRouterParam, readBody } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { requireRoomAccess } from '../../../utils/permissions'
import { prisma } from '../../../utils/prisma'
import { setRoomPresence } from '../../../utils/presence'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'id') || ''
  await requireRoomAccess(roomId, user.id)

  const body = await readBody<{ online?: boolean }>(event)
  const online = body?.online !== false
  const result = setRoomPresence(roomId, user.id, user.name, online)

  if (result.changed) {
    const session = await prisma.session.findFirst({ where: { roomId, status: 'ACTIVE' } })
    await prisma.chatMessage.create({
      data: {
        roomId,
        sessionId: session?.id,
        userId: user.id,
        type: 'SYSTEM',
        content: online ? `${user.name} entrou na sala.` : `${user.name} saiu da sala.`,
        metadataJson: { action: online ? 'PRESENCE_JOIN' : 'PRESENCE_LEAVE' }
      }
    })
  }

  return { online }
})
