import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const npc = await prisma.npc.findUnique({ where: { id } })

  if (!npc) {
    throw createError({ statusCode: 404, statusMessage: 'NPC nao encontrado.' })
  }

  if (npc.createdById !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Voce so pode apagar NPCs criados por voce.' })
  }

  await prisma.npc.delete({ where: { id } })
  return { ok: true }
})

