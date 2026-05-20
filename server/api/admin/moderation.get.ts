import { getQuery } from 'h3'
import { requireAdmin } from '../../utils/adminAuth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(String(query.status)) ? String(query.status) : 'PENDING'

  const [systems, npcs, posts] = await Promise.all([
    prisma.system.findMany({
      where: { moderationStatus: status as 'PENDING' | 'APPROVED' | 'REJECTED' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        fields: { orderBy: { order: 'asc' } },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } } }
        },
        _count: { select: { characters: true, rooms: true, likes: true, comments: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 80
    }),
    prisma.npc.findMany({
      where: { moderationStatus: status as 'PENDING' | 'APPROVED' | 'REJECTED' },
      include: {
        system: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } } }
        },
        _count: { select: { likes: true, comments: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 80
    }),
    prisma.communityPost.findMany({
      where: { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' },
      include: {
        author: { select: { id: true, name: true, username: true, email: true, avatarUrl: true, profileColor: true } },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } } }
        },
        _count: { select: { likes: true, comments: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 120
    })
  ])

  return { systems, npcs, posts }
})
