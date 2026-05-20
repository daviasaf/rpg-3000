import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { requireRoomMaster } from '../../../../utils/permissions'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'id') || ''
  await requireRoomMaster(roomId, user.id)

  const session = await prisma.session.findFirst({ where: { roomId, status: 'ACTIVE' } })
  if (!session) {
    throw createError({ statusCode: 400, statusMessage: 'Nao ha sessao ativa.' })
  }

  const ended = await prisma.session.update({
    where: { id: session.id },
    data: { status: 'ENDED', endedAt: new Date() }
  })

  await prisma.chatMessage.create({
    data: {
      roomId,
      sessionId: ended.id,
      userId: user.id,
      type: 'SYSTEM',
      content: 'Sessao encerrada pelo mestre.'
    }
  })

  return { session: ended }
})
