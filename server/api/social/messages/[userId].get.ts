import { getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const otherId = getRouterParam(event, 'userId') || ''
  const messages = await prisma.privateMessage.findMany({
    where: {
      OR: [
        { senderId: user.id, receiverId: otherId },
        { senderId: otherId, receiverId: user.id }
      ]
    },
    include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true } } },
    orderBy: { createdAt: 'asc' },
    take: 120
  })

  await prisma.privateMessage.updateMany({
    where: { senderId: otherId, receiverId: user.id, readAt: null },
    data: { readAt: new Date() }
  })

  return { messages }
})
