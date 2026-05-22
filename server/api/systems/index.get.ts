import { getQuery } from 'h3'
import { getAuthUser } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { withPrismaErrors } from '../../utils/prismaErrors'

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)
  const query = getQuery(event)
  const mineOnly = query.mine === 'true'
  const community = query.community === 'true'
  const commentTake = community ? 20 : 3

  const systems = await withPrismaErrors(() => prisma.system.findMany({
    where: community
      ? { visibility: 'PUBLIC', moderationStatus: 'APPROVED' }
      : user
        ? { createdById: user.id }
        : { visibility: 'PUBLIC', moderationStatus: 'APPROVED' },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true, profileColor: true } },
      fields: { orderBy: { order: 'asc' } },
      ...(user ? { likes: { where: { userId: user.id }, select: { id: true } } } : {}),
      comments: {
        orderBy: { createdAt: 'desc' },
        take: commentTake,
        include: { user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } } }
      },
      _count: { select: { characters: true, rooms: true, likes: true, comments: true } }
    },
    orderBy: [{ createdAt: 'desc' }]
  }))

  return { systems }
})

