import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { updateSystemSchema } from '../../../utils/validation'
import { jsonValue, nullableJsonValue } from '../../../utils/json'
import { readZodBody } from '../../../utils/body'
import { slugify } from '../../../utils/slug'
import { validateSystemRules } from '~~/shared/utils/characterRules'

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
  const input = await readZodBody(event, updateSystemSchema)
  const system = await prisma.system.findUnique({ where: { id }, include: { fields: true } })

  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'Sistema nao encontrado.' })
  }

  if (system.createdById !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Voce so pode editar sistemas criados por voce.' })
  }

  if (system.moderationStatus === 'REJECTED') {
    throw createError({ statusCode: 403, statusMessage: 'Sistema rejeitado nao pode ser editado. Crie uma nova versao para enviar novamente.' })
  }

  if (input.fields || input.schemaJson) {
    const ruleErrors = validateSystemRules((input.schemaJson ?? system.schemaJson) as any, (input.fields ?? system.fields) as any)
    if (ruleErrors.length) {
      throw createError({ statusCode: 400, statusMessage: ruleErrors[0], data: { errors: ruleErrors } })
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.fields) {
      const keys = new Set(input.fields.map((field) => field.key))
      if (keys.size !== input.fields.length) {
        throw createError({ statusCode: 400, statusMessage: 'As chaves dos campos precisam ser unicas.' })
      }
    }

    const createsReviewVersion = system.visibility === 'PUBLIC' && system.moderationStatus === 'APPROVED'
    if (createsReviewVersion) {
      const previousSchema = system.schemaJson as Record<string, any>
      const previousVersion = Number(String(previousSchema.version || 'v1').replace(/^v/i, '')) || 1
      const schemaJson = {
        ...(input.schemaJson ?? previousSchema),
        version: `v${previousVersion + 1}`,
        versionOfSystemId: system.id,
        previousApprovedSystemId: system.id,
        versionCreatedAt: new Date().toISOString()
      }
      const next = await tx.system.create({
        data: {
          name: input.name ?? system.name,
          slug: await createUniqueSlug(input.name ?? system.name),
          description: input.description ?? system.description,
          avatarUrl: input.avatarUrl === undefined ? system.avatarUrl : input.avatarUrl || null,
          tags: input.tags ?? system.tags,
          visibility: input.visibility ?? system.visibility,
          moderationStatus: input.visibility === 'PRIVATE' ? 'APPROVED' : 'PENDING',
          moderationReason: null,
          createdById: user.id,
          schemaJson: jsonValue(schemaJson),
          fields: {
            create: (input.fields ?? system.fields).map((field, index) => ({
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
        },
        include: { fields: { orderBy: { order: 'asc' } } }
      })
      return next
    }

    if (input.fields) {
      await tx.systemField.deleteMany({ where: { systemId: id } })
    }

    return tx.system.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        avatarUrl: input.avatarUrl === undefined ? undefined : input.avatarUrl || null,
        tags: input.tags,
        visibility: input.visibility,
        moderationStatus: input.visibility === 'PUBLIC' ? 'PENDING' : input.visibility === 'PRIVATE' ? 'APPROVED' : undefined,
        moderationReason: input.visibility === 'PUBLIC' || input.visibility === 'PRIVATE' ? null : undefined,
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

