import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAdmin } from '../../../../utils/adminAuth'
import { prisma } from '../../../../utils/prisma'

const schema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(600).optional().nullable()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const body = schema.parse(await readBody(event))
  const post = await prisma.communityPost.findUnique({ where: { id } })

  if (!post) throw createError({ statusCode: 404, statusMessage: 'Publicacao nao encontrada.' })

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.communityPost.update({
      where: { id },
      data: { status: body.status, moderationReason: body.status === 'REJECTED' ? body.reason || null : null }
    })

    const sourceData = {
      moderationStatus: body.status,
      moderationReason: body.status === 'REJECTED' ? body.reason || null : null
    }

    if (post.originalSystemId) {
      await tx.system.updateMany({ where: { id: post.originalSystemId }, data: sourceData })
    }
    if (post.originalNpcId) {
      await tx.npc.updateMany({ where: { id: post.originalNpcId }, data: sourceData })
    }
    if (post.originalCharacterId) {
      await tx.character.updateMany({ where: { id: post.originalCharacterId }, data: sourceData })
    }

    return next
  })

  return { post: updated }
})

