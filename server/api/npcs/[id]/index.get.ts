import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const npc = await prisma.npc.findUnique({
    where: { id },
    include: {
      system: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, avatarUrl: true, profileColor: true } },
      likes: { where: { userId: user.id }, select: { id: true } },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } } }
      },
      _count: { select: { likes: true, comments: true } }
    }
  })

  if (!npc) {
    throw createError({ statusCode: 404, statusMessage: 'NPC nao encontrado.' })
  }

  const isOwner = npc.createdById === user.id
  const isCommunityApproved = npc.isCommunity && npc.moderationStatus === 'APPROVED'

  if (!isOwner && !isCommunityApproved) {
    throw createError({ statusCode: 403, statusMessage: 'Este NPC nao esta disponivel para voce.' })
  }

  return { npc }
})
