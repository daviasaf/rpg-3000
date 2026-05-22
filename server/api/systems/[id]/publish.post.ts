import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { publishSystemSnapshot } from '../../../utils/community'
import { assertActionCooldown } from '../../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  assertActionCooldown(`system-publish:${user.id}:${id}`, 2000)
  const system = await prisma.system.findUnique({ where: { id } })

  if (!system) throw createError({ statusCode: 404, statusMessage: 'Sistema nao encontrado.' })
  if (system.createdById !== user.id) throw createError({ statusCode: 403, statusMessage: 'Voce so pode publicar seus sistemas.' })
  if (system.moderationStatus === 'REJECTED') throw createError({ statusCode: 403, statusMessage: 'Sistema rejeitado nao pode ser republicado por edicao. Crie uma nova versao.' })
  const provenance = (system.schemaJson as Record<string, any>)?.provenance
  if (provenance?.originalCreatorId && provenance.originalCreatorId !== user.id) {
    await prisma.privateMessage.create({
      data: {
        senderId: user.id,
        receiverId: provenance.originalCreatorId,
        content: `Fiz uma versao do sistema "${system.name}" que voce criou, mas preciso da sua autorizacao para postar. Visualize: /app/systems/${system.id}`
      }
    })
    throw createError({ statusCode: 403, statusMessage: 'Pedido de autorizacao enviado ao criador original antes da publicacao.' })
  }

  await prisma.system.update({ where: { id }, data: { moderationStatus: 'PENDING', moderationReason: null, visibility: 'PUBLIC' } })
  const post = await publishSystemSnapshot(id, user.id)
  return { post }
})
