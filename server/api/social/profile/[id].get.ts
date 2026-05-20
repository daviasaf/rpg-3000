import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const profile = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true, createdAt: true }
  })

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Perfil nao encontrado.' })
  }

  const [posts, profileComments, systems, npcs, characters, friendship, sent, received] = await Promise.all([
    prisma.profilePost.findMany({
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
    }),
    prisma.profileWallComment.findMany({
      where: { profileId: id },
      include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true } } },
      orderBy: { createdAt: 'desc' },
      take: 60
    }),
    prisma.system.findMany({
      where: { createdById: id },
      select: { id: true, name: true, description: true, avatarUrl: true, moderationStatus: true, moderationReason: true, createdAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 12
    }),
    prisma.npc.findMany({
      where: { createdById: id },
      select: { id: true, name: true, description: true, avatarUrl: true, moderationStatus: true, moderationReason: true, createdAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 12
    }),
    prisma.character.findMany({
      where: { userId: id },
      select: { id: true, name: true, description: true, avatarUrl: true, moderationStatus: true, moderationReason: true, createdAt: true, system: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 12
    }),
    prisma.friendRequest.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: user.id, receiverId: id },
          { senderId: id, receiverId: user.id }
        ]
      }
    }),
    prisma.friendRequest.findFirst({ where: { senderId: user.id, receiverId: id, status: 'PENDING' } }),
    prisma.friendRequest.findFirst({ where: { senderId: id, receiverId: user.id, status: 'PENDING' } })
  ])

  return {
    profile,
    posts,
    profileComments,
    systems,
    npcs,
    characters,
    social: {
      isSelf: user.id === id,
      isFriend: Boolean(friendship),
      sentRequestId: sent?.id || null,
      receivedRequestId: received?.id || null
    }
  }
})
