import { getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const q = String(getQuery(event).q || '').trim()
  if (q.length < 2) return { users: [] }

  const users = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } }
      ]
    },
    select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true },
    take: 12
  })

  return { users }
})

