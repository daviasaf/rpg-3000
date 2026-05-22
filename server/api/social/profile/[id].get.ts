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

  const [posts, profileComments, systems, npcs, characters, approvedSystems, approvedPosts, friendship, sent, received, likesCount, likedByMe] = await Promise.all([
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
      where: { createdById: id, featuredOnProfile: true, moderationStatus: 'APPROVED' },
      select: { id: true, name: true, description: true, avatarUrl: true, moderationStatus: true, moderationReason: true, featuredOnProfile: true, createdAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 12
    }),
    prisma.npc.findMany({
      where: { createdById: id, featuredOnProfile: true, moderationStatus: 'APPROVED' },
      select: { id: true, name: true, description: true, avatarUrl: true, moderationStatus: true, moderationReason: true, featuredOnProfile: true, createdAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 12
    }),
    prisma.character.findMany({
      where: { userId: id, featuredOnProfile: true, moderationStatus: 'APPROVED' },
      select: { id: true, name: true, description: true, avatarUrl: true, moderationStatus: true, moderationReason: true, featuredOnProfile: true, createdAt: true, system: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 12
    }),
    prisma.system.findMany({
      where: { createdById: id, moderationStatus: 'APPROVED' },
      select: { id: true, schemaJson: true, createdAt: true, updatedAt: true }
    }),
    prisma.communityPost.findMany({
      where: { authorId: id, status: 'APPROVED' },
      select: { type: true, originalSystemId: true, originalNpcId: true, originalCharacterId: true, createdAt: true }
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
    prisma.friendRequest.findFirst({ where: { senderId: id, receiverId: user.id, status: 'PENDING' } }),
    prisma.userProfileLike.count({ where: { profileId: id } }),
    prisma.userProfileLike.findUnique({ where: { profileId_userId: { profileId: id, userId: user.id } }, select: { id: true } })
  ])

  const systemsWithFlags = systems.map((system) => ({
    ...system,
    hasNewVersion: approvedSystems.some((candidate) => {
      const schema = candidate.schemaJson as Record<string, unknown>
      return schema?.previousApprovedSystemId === system.id || schema?.versionOfSystemId === system.id
    }) || approvedPosts.some((post) => post.type === 'SYSTEM' && post.originalSystemId === system.id && post.createdAt > system.createdAt)
  }))
  const npcsWithFlags = npcs.map((npc) => ({
    ...npc,
    hasNewVersion: approvedPosts.some((post) => post.type === 'NPC' && post.originalNpcId === npc.id && post.createdAt > npc.createdAt)
  }))
  const charactersWithFlags = characters.map((character) => ({
    ...character,
    hasNewVersion: approvedPosts.some((post) => post.type === 'CHARACTER' && post.originalCharacterId === character.id && post.createdAt > character.createdAt)
  }))

  return {
    profile,
    posts,
    profileComments,
    systems: systemsWithFlags,
    npcs: npcsWithFlags,
    characters: charactersWithFlags,
    profileLikes: {
      count: likesCount,
      likedByMe: Boolean(likedByMe)
    },
    social: {
      isSelf: user.id === id,
      isFriend: Boolean(friendship),
      sentRequestId: sent?.id || null,
      receivedRequestId: received?.id || null
    }
  }
})

