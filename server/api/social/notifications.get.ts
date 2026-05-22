import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const [unreadMessages, pendingRequests] = await Promise.all([
    prisma.privateMessage.count({ where: { receiverId: user.id, readAt: null } }),
    prisma.friendRequest.count({ where: { receiverId: user.id, status: 'PENDING' } })
  ])

  return {
    unreadMessages,
    pendingRequests,
    total: unreadMessages + pendingRequests
  }
})
