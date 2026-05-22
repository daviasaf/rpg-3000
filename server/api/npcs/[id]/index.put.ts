import { createError, getRouterParam } from 'h3'
import { z } from 'zod'
import { readZodBody } from '../../../utils/body'
import { requireAuth } from '../../../utils/auth'
import { jsonValue } from '../../../utils/json'
import { prisma } from '../../../utils/prisma'
import { publishNpcSnapshot } from '../../../utils/community'

const updateNpcSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  avatarUrl: z.string().trim().url().optional().or(z.literal('')).nullable(),
  systemId: z.string().optional().nullable(),
  isCommunity: z.boolean().optional(),
  dataJson: z.record(z.unknown()).optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const input = await readZodBody(event, updateNpcSchema)
  const npc = await prisma.npc.findUnique({ where: { id } })

  if (!npc) {
    throw createError({ statusCode: 404, statusMessage: 'NPC nao encontrado.' })
  }

  if (npc.createdById !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Voce so pode editar NPCs criados por voce.' })
  }

  if (npc.moderationStatus === 'REJECTED') {
    throw createError({ statusCode: 403, statusMessage: 'NPC rejeitado nao pode ser editado. Crie uma nova versao para enviar novamente.' })
  }

  const hasApprovedCommunityPost = await prisma.communityPost.count({ where: { originalNpcId: id, status: 'APPROVED' } })
  const shouldReturnToReview = Boolean(hasApprovedCommunityPost || (npc.isCommunity && npc.moderationStatus === 'APPROVED'))

  const updated = await prisma.npc.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      avatarUrl: input.avatarUrl === '' ? null : input.avatarUrl,
      systemId: input.systemId === undefined ? undefined : input.systemId || null,
      isCommunity: input.isCommunity,
      moderationStatus: input.isCommunity === true || shouldReturnToReview ? 'PENDING' : input.isCommunity === false ? 'APPROVED' : undefined,
      moderationReason: input.isCommunity === true || input.isCommunity === false || shouldReturnToReview ? null : undefined,
      featuredOnProfile: shouldReturnToReview ? false : undefined,
      dataJson: input.dataJson === undefined ? undefined : jsonValue(input.dataJson)
    },
    include: {
      system: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { likes: true, comments: true } }
    }
  })

  if (input.isCommunity === true) {
    await publishNpcSnapshot(updated.id, user.id)
  }

  return { npc: updated }
})

