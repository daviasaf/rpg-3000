import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { jsonValue } from '../../../utils/json'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const system = await prisma.system.findUnique({
    where: { id },
    include: { fields: { orderBy: { order: 'asc' } } }
  })

  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'Sistema nao encontrado.' })
  }

  if (system.createdById !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Voce so pode excluir sistemas criados por voce.' })
  }

  const snapshot = jsonValue({
    id: system.id,
    name: system.name,
    description: system.description,
    avatarUrl: system.avatarUrl,
    tags: system.tags,
    schemaJson: system.schemaJson,
    fields: system.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      category: field.category,
      defaultValue: field.defaultValue,
      optionsJson: field.optionsJson,
      formula: field.formula,
      order: field.order
    })),
    removedAt: new Date().toISOString()
  })

  await prisma.$transaction(async (tx) => {
    await tx.room.deleteMany({ where: { systemId: id } })
    await tx.character.updateMany({
      where: { systemId: id },
      data: {
        systemId: null,
        systemSnapshotJson: snapshot,
        systemRemovedAt: new Date()
      }
    })
    await tx.system.delete({ where: { id } })
  })

  return { ok: true }
})
