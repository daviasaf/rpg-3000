import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const friendId = getRouterParam(event, 'id') || ''

  if (friendId === user.id) {
    throw createError({ statusCode: 400, statusMessage: 'Voce nao pode remover amizade de si mesmo.' })
  }

  const friendship = await prisma.friendRequest.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: user.id, receiverId: friendId },
        { senderId: friendId, receiverId: user.id }
      ]
    }
  })

  if (!friendship) {
    throw createError({ statusCode: 404, statusMessage: 'Amizade nao encontrada.' })
  }

  await prisma.friendRequest.delete({ where: { id: friendship.id } })
  return { ok: true }
})

