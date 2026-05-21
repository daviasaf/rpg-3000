import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { publishNpcSnapshot } from '../../../utils/community'
import { assertActionCooldown } from '../../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  assertActionCooldown(`npc-publish:${user.id}:${id}`, 2000)
  const npc = await prisma.npc.findUnique({ where: { id } })

  if (!npc) throw createError({ statusCode: 404, statusMessage: 'NPC nao encontrado.' })
  if (npc.createdById !== user.id) throw createError({ statusCode: 403, statusMessage: 'Voce so pode publicar seus NPCs.' })
  if (npc.moderationStatus === 'REJECTED') throw createError({ statusCode: 403, statusMessage: 'NPC rejeitado nao pode ser republicado por edicao. Crie uma nova versao.' })

  await prisma.npc.update({ where: { id }, data: { isCommunity: true, moderationStatus: 'PENDING', moderationReason: null } })
  const post = await publishNpcSnapshot(id, user.id)
  return { post }
})
