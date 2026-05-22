import { getQuery } from 'h3'
import { requireAdmin } from '../../utils/adminAuth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q.trim() : ''

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } }
          ]
        }
      : undefined,
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      avatarUrl: true,
      profileColor: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          systems: true,
          npcs: true,
          characters: true,
          masteredRooms: true,
          roomMembers: true,
          communityPosts: true,
          communityComments: true,
          profilePosts: true,
          privateMessages: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 200
  })

  return { users }
})

