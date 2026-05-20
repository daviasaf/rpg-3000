import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const npcId = getRouterParam(event, 'id') || ''
  const npc = await prisma.npc.findUnique({ where: { id: npcId } })

  if (!npc) {
    throw createError({ statusCode: 404, statusMessage: 'NPC nao encontrado.' })
  }

  const existing = await prisma.npcLike.findUnique({ where: { npcId_userId: { npcId, userId: user.id } } })
  if (existing) {
    await prisma.npcLike.delete({ where: { id: existing.id } })
    return { liked: false }
  }

  await prisma.npcLike.create({ data: { npcId, userId: user.id } })
  return { liked: true }
})
