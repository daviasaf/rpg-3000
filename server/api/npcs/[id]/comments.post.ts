import { createError, getRouterParam } from 'h3'
import { z } from 'zod'
import { readZodBody } from '../../../utils/body'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

const commentSchema = z.object({
  content: z.string().trim().min(1).max(600)
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const npcId = getRouterParam(event, 'id') || ''
  const input = await readZodBody(event, commentSchema)
  const npc = await prisma.npc.findUnique({ where: { id: npcId } })

  if (!npc) {
    throw createError({ statusCode: 404, statusMessage: 'NPC nao encontrado.' })
  }

  const comment = await prisma.npcComment.create({
    data: { npcId, userId: user.id, content: input.content },
    include: { user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } } }
  })

  return { comment }
})

