import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const [sent, received] = await Promise.all([
    prisma.friendRequest.findMany({
      where: { senderId: user.id },
      include: { receiver: { select: { id: true, name: true, username: true, email: true, avatarUrl: true, profileColor: true } } },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.friendRequest.findMany({
      where: { receiverId: user.id },
      include: { sender: { select: { id: true, name: true, username: true, email: true, avatarUrl: true, profileColor: true } } },
      orderBy: { updatedAt: 'desc' }
    })
  ])

  return {
    friends: [
      ...sent.filter((item) => item.status === 'ACCEPTED').map((item) => item.receiver),
      ...received.filter((item) => item.status === 'ACCEPTED').map((item) => item.sender)
    ],
    sent,
    received
  }
})
