import { getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { requireRoomMaster } from '../../../../utils/permissions'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'id') || ''
  await requireRoomMaster(roomId, user.id)

  await prisma.session.updateMany({
    where: { roomId, status: 'ACTIVE' },
    data: { status: 'ENDED', endedAt: new Date() }
  })

  const session = await prisma.session.create({
    data: { roomId, status: 'ACTIVE' }
  })

  await prisma.chatMessage.create({
    data: {
      roomId,
      sessionId: session.id,
      userId: user.id,
      type: 'SYSTEM',
      content: 'Sessao iniciada pelo mestre.'
    }
  })

  return { session }
})
