import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const profile = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true, createdAt: true }
  })

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Perfil nao encontrado.' })
  }

  const posts = await prisma.profilePost.findMany({
    where: { userId: id, isPublic: true },
    include: {
      user: { select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true } },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } } }
      },
      _count: { select: { likes: true, comments: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 30
  })

  return { profile, posts }
})
