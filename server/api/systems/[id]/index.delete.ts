import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const system = await prisma.system.findUnique({ where: { id } })

  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'Sistema nao encontrado.' })
  }

  if (system.createdById !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Voce so pode excluir sistemas criados por voce.' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.room.deleteMany({ where: { systemId: id } })
    await tx.character.deleteMany({ where: { systemId: id } })
    await tx.system.delete({ where: { id } })
  })

  return { ok: true }
})
