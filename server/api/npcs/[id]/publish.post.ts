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
  if (npc.moderationStatus === 'PENDING') throw createError({ statusCode: 403, statusMessage: 'Este conteudo ainda esta em analise. Voce pode editar ou apagar, mas nao pode publicar novamente ate ser aprovado.' })
  if (npc.moderationStatus === 'REJECTED') throw createError({ statusCode: 403, statusMessage: 'NPC rejeitado nao pode ser republicado por edicao. Crie uma nova versao.' })
  const meta = (npc.dataJson as Record<string, any>)?.__meta
  if (meta?.originalCreatorId && meta.originalCreatorId !== user.id) {
    await prisma.privateMessage.create({
      data: {
        senderId: user.id,
        receiverId: meta.originalCreatorId,
        content: `Fiz uma versao do NPC "${npc.name}" que voce criou, mas preciso da sua autorizacao para postar. Visualize: /app/npcs/${npc.id}`
      }
    })
    throw createError({ statusCode: 403, statusMessage: 'Pedido de autorizacao enviado ao criador original antes da publicacao.' })
  }

  await prisma.npc.update({ where: { id }, data: { isCommunity: true, moderationStatus: 'PENDING', moderationReason: null } })
  const post = await publishNpcSnapshot(id, user.id)
  return { post }
})

