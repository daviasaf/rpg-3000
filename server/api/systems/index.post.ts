import { createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { createSystemSchema } from '../../utils/validation'
import { slugify } from '../../utils/slug'
import { jsonValue, nullableJsonValue } from '../../utils/json'
import { readZodBody } from '../../utils/body'
import { withPrismaErrors } from '../../utils/prismaErrors'
import { publishSystemSnapshot } from '../../utils/community'
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
  const input = await readZodBody(event, createSystemSchema)
  const keys = new Set(input.fields.map((field) => field.key))

  if (keys.size !== input.fields.length) {
    throw createError({ statusCode: 400, statusMessage: 'As chaves dos campos precisam ser unicas.' })
  }
  const ruleErrors = validateSystemRules(input.schemaJson as any, input.fields as any)
  if (ruleErrors.length) {
    throw createError({ statusCode: 400, statusMessage: ruleErrors[0], data: { errors: ruleErrors } })
  }

  const system = await withPrismaErrors(async () => prisma.system.create({
    data: {
      name: input.name,
      slug: await createUniqueSlug(input.name),
      description: input.description,
      avatarUrl: input.avatarUrl || null,
      tags: input.tags,
      visibility: input.visibility,
      moderationStatus: input.visibility === 'PUBLIC' ? 'PENDING' : 'APPROVED',
      schemaJson: jsonValue({
        ...(input.schemaJson as Record<string, unknown>),
        provenance: {
          ...((input.schemaJson as Record<string, any>).provenance || {}),
          originalCreatorId: user.id,
          originalCreatorName: user.name
        }
      }),
      createdById: user.id,
      fields: {
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
    },
    include: { fields: { orderBy: { order: 'asc' } } }
  }))

  if (input.visibility === 'PUBLIC') {
    await publishSystemSnapshot(system.id, user.id)
  }

  return { system }
})

