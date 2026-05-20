import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { updateSystemSchema } from '../../../utils/validation'
import { jsonValue, nullableJsonValue } from '../../../utils/json'
import { readZodBody } from '../../../utils/body'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const input = await readZodBody(event, updateSystemSchema)
  const system = await prisma.system.findUnique({ where: { id }, include: { fields: true } })

  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'Sistema nao encontrado.' })
  }

  if (system.createdById !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Voce so pode editar sistemas criados por voce.' })
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.fields) {
      const keys = new Set(input.fields.map((field) => field.key))
      if (keys.size !== input.fields.length) {
        throw createError({ statusCode: 400, statusMessage: 'As chaves dos campos precisam ser unicas.' })
      }
      await tx.systemField.deleteMany({ where: { systemId: id } })
    }

    return tx.system.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        tags: input.tags,
        visibility: input.visibility,
        moderationStatus: input.visibility === 'PUBLIC' ? 'PENDING' : input.visibility === 'PRIVATE' ? 'APPROVED' : undefined,
        schemaJson: input.schemaJson === undefined ? undefined : jsonValue(input.schemaJson),
        fields: input.fields
          ? {
              create: input.fields.map((field, index) => ({
                key: field.key,
                label: field.label,
                type: field.type,
                category: field.category,
                defaultValue: nullableJsonValue(field.defaultValue),
                optionsJson: nullableJsonValue(field.optionsJson),
                formula: field.formula,
                order: field.order ?? index
              }))
            }
          : undefined
      },
      include: { fields: { orderBy: { order: 'asc' } } }
    })
  })

  return { system: updated }
})
