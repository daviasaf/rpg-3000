import { getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)
  const systemId = typeof query.systemId === 'string' ? query.systemId : undefined
  const community = query.community === 'true'
  const commentTake = query.community === 'true' ? 20 : 3

  const npcs = await prisma.npc.findMany({
    where: {
      ...(systemId ? { systemId } : {}),
      ...(community ? { isCommunity: true, moderationStatus: 'APPROVED' } : { createdById: user.id })
    },
    include: {
      system: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, avatarUrl: true, profileColor: true } },
      likes: { where: { userId: user.id }, select: { id: true } },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: commentTake,
        include: { user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } } }
      },
      _count: { select: { likes: true, comments: true } }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return { npcs }
})
