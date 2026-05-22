import { createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { createCharacterSchema } from '../../utils/validation'
import { jsonValue, nullableJsonValue } from '../../utils/json'
import { readZodBody } from '../../utils/body'
import { slugify } from '../../utils/slug'
import { normalizeSheetTabs } from '~~/shared/utils/sheetTabs'
import { validateCharacterData } from '~~/shared/utils/characterRules'

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
  const input = await readZodBody(event, createCharacterSchema)
  const system = await prisma.system.findUnique({ where: { id: input.systemId }, include: { createdBy: { select: { name: true } }, fields: true } })

  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'Sistema nao encontrado.' })
  }

  const isOwner = system.createdById === user.id
  const isPublicApproved = system.visibility === 'PUBLIC' && system.moderationStatus === 'APPROVED'
  if (!isOwner && !isPublicApproved) {
    throw createError({ statusCode: 403, statusMessage: 'Voce nao pode criar personagem neste sistema.' })
  }

  let characterSystem = system
  if (!isOwner) {
    const version = (system.schemaJson as Record<string, any>)?.version || 'v1'
    const existingCopy = await prisma.system.findFirst({
      where: {
        createdById: user.id,
        visibility: 'PRIVATE',
        schemaJson: { path: ['provenance', 'sourceSystemId'], equals: system.id }
      } as any,
      include: { fields: true }
    })
    characterSystem = existingCopy || await prisma.system.create({
      data: {
        name: system.name,
        slug: await createUniqueSlug(`${system.name}-${user.id.slice(0, 6)}`),
        description: system.description,
        avatarUrl: system.avatarUrl,
        tags: system.tags,
        visibility: 'PRIVATE',
        moderationStatus: 'APPROVED',
        createdById: user.id,
        schemaJson: jsonValue({
          ...(system.schemaJson as Record<string, any>),
          version,
          provenance: {
            ...((system.schemaJson as Record<string, any>)?.provenance || {}),
            sourceSystemId: system.id,
            originalCreatorId: system.createdById,
            originalCreatorName: (system.schemaJson as Record<string, any>)?.provenance?.originalCreatorName || system.createdBy?.name || null,
            copiedById: user.id,
            copiedAt: new Date().toISOString()
          }
        }),
        fields: {
          create: system.fields.map((field) => ({
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
      include: { fields: true }
    })
  }

  const defaults = Object.fromEntries(
    characterSystem.fields.map((field) => [field.key, field.category === 'ATTRIBUTE' ? Number(field.defaultValue ?? 0) : field.defaultValue ?? null])
  )
  for (const tab of normalizeSheetTabs(characterSystem.schemaJson as any)) {
    if (['ITEMS', 'WEAPONS', 'TRAITS', 'POWERS', 'CONDITIONS', 'CUSTOM'].includes(tab.type)) {
      defaults[tab.key] = []
    } else if (tab.type !== 'RULES' && tab.type !== 'CLASS_PROGRESS') {
      defaults[tab.key] = {}
    }
  }
  const dataJson = { ...defaults, ...input.dataJson }
  dataJson.__meta = {
    ...((dataJson.__meta as Record<string, unknown>) || {}),
    systemId: characterSystem.id,
    systemName: characterSystem.name,
    systemVersion: (characterSystem.schemaJson as Record<string, any>)?.version || 'v1'
  }
  const ruleErrors = validateCharacterData(characterSystem.schemaJson as any, characterSystem.fields as any, dataJson)
  if (ruleErrors.length) {
    throw createError({ statusCode: 400, statusMessage: ruleErrors[0], data: { errors: ruleErrors } })
  }

  const character = await prisma.character.create({
    data: {
      name: input.name,
      description: input.description,
      avatarUrl: input.avatarUrl || null,
      userId: user.id,
      systemId: characterSystem.id,
      dataJson: jsonValue(dataJson),
      values: {
        create: Object.entries(dataJson).map(([key, value]) => ({
          key,
          valueJson: jsonValue(value),
          fieldId: characterSystem.fields.find((field) => field.key === key)?.id
        }))
      }
    },
    include: {
      system: { include: { fields: { orderBy: { order: 'asc' } } } },
      values: true
    }
  })

  return { character }
})

