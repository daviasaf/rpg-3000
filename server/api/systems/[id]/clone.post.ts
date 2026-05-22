import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { nullableJsonValue, jsonValue } from '../../../utils/json'
import { prisma } from '../../../utils/prisma'
import { slugify } from '../../../utils/slug'

async function createUniqueSlug(name: string) {
  const base = slugify(name) || 'sistema'
  let slug = base
  let index = 1
  while (await prisma.system.findUnique({ where: { slug } })) {
    index += 1
    slug = `${base}-${index}`
  }
  return slug
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const source = await prisma.system.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true } }, fields: { orderBy: { order: 'asc' } } }
  })

  if (!source) {
    throw createError({ statusCode: 404, statusMessage: 'Sistema nao encontrado.' })
  }

  if (source.visibility === 'PRIVATE' && source.createdById !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Este sistema nao pode ser adicionado.' })
  }

  const originalSchema = source.schemaJson as Record<string, any>
  const name = source.name
  const originalCreator = source.createdById
  const system = await prisma.system.create({
    data: {
      name,
      slug: await createUniqueSlug(`${name}-${user.id.slice(0, 6)}`),
      description: source.description,
      avatarUrl: source.avatarUrl,
      tags: source.tags,
      visibility: 'PRIVATE',
      moderationStatus: 'APPROVED',
      schemaJson: jsonValue({
        ...originalSchema,
        version: originalSchema.version || 'v1',
        provenance: {
          ...(originalSchema.provenance || {}),
          sourceSystemId: source.id,
          originalCreatorId: originalSchema.provenance?.originalCreatorId || originalCreator,
          originalCreatorName: originalSchema.provenance?.originalCreatorName || source.createdBy?.name || null,
          copiedById: user.id,
          copiedAt: new Date().toISOString()
        }
      }),
      createdById: user.id,
      fields: {
        create: source.fields.map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          category: field.category,
          defaultValue: nullableJsonValue(field.defaultValue),
          optionsJson: nullableJsonValue(field.optionsJson),
          formula: field.formula,
          order: field.order
        }))
      }
    },
    include: { createdBy: { select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true } }, fields: { orderBy: { order: 'asc' } } }
  })

  return { system }
})

