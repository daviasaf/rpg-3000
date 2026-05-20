import { createError, getRouterParam } from 'h3'
import { getAuthUser } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)
  const id = getRouterParam(event, 'id') || ''
  const system = await prisma.system.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true, profileColor: true } },
      fields: { orderBy: { order: 'asc' } },
      ...(user ? { likes: { where: { userId: user.id } } } : {}),
      comments: {
        include: { user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20
      },
      _count: { select: { likes: true, comments: true, characters: true, rooms: true } }
    }
  })

  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'Sistema nao encontrado.' })
  }

  const isOwner = system.createdById === user?.id
  const isPublicApproved = system.visibility === 'PUBLIC' && system.moderationStatus === 'APPROVED'

  if (!isOwner && !isPublicApproved) {
    throw createError({ statusCode: 403, statusMessage: 'Sistema indisponivel.' })
  }

  return { system }
})
