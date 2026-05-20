import { getQuery } from 'h3'
import { getAuthUser } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)
  const query = getQuery(event)
  const type = typeof query.type === 'string' && ['SYSTEM', 'NPC', 'CHARACTER'].includes(query.type) ? query.type : undefined
  const mine = query.mine === 'true'
  const status = typeof query.status === 'string' && ['PENDING', 'APPROVED', 'REJECTED'].includes(query.status) ? query.status : 'APPROVED'

  const posts = await prisma.communityPost.findMany({
    where: {
      ...(type ? { type: type as 'SYSTEM' | 'NPC' | 'CHARACTER' } : {}),
      ...(mine && user ? { authorId: user.id } : { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' })
    },
    include: {
      author: { select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true } },
      ...(user ? { likes: { where: { userId: user.id }, select: { id: true } } } : {}),
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true } } }
      },
      _count: { select: { likes: true, comments: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return { posts }
})
