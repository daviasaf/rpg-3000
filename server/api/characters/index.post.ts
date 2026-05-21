import { createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { createCharacterSchema } from '../../utils/validation'
import { jsonValue } from '../../utils/json'
import { readZodBody } from '../../utils/body'
import { normalizeSheetTabs } from '~~/shared/utils/sheetTabs'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await readZodBody(event, createCharacterSchema)
  const system = await prisma.system.findUnique({ where: { id: input.systemId }, include: { fields: true } })

  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'Sistema nao encontrado.' })
  }

  const isOwner = system.createdById === user.id
  const isPublicApproved = system.visibility === 'PUBLIC' && system.moderationStatus === 'APPROVED'
  if (!isOwner && !isPublicApproved) {
    throw createError({ statusCode: 403, statusMessage: 'Voce nao pode criar personagem neste sistema.' })
  }

  const defaults = Object.fromEntries(
    system.fields.map((field) => [field.key, field.category === 'ATTRIBUTE' ? Number(field.defaultValue ?? 0) : field.defaultValue ?? null])
  )
  for (const tab of normalizeSheetTabs(system.schemaJson as any).filter((item) => item.enabled !== false)) {
    if (['ITEMS', 'WEAPONS', 'TRAITS', 'POWERS', 'CONDITIONS', 'CUSTOM'].includes(tab.type)) {
      defaults[tab.key] = []
    } else if (tab.type !== 'RULES' && tab.type !== 'CLASS_PROGRESS') {
      defaults[tab.key] = {}
    }
  }
  const dataJson = { ...defaults, ...input.dataJson }

  const character = await prisma.character.create({
    data: {
      name: input.name,
      description: input.description,
      avatarUrl: input.avatarUrl || null,
      userId: user.id,
      systemId: input.systemId,
      dataJson: jsonValue(dataJson),
      values: {
        create: Object.entries(dataJson).map(([key, value]) => ({
          key,
          valueJson: jsonValue(value),
          fieldId: system.fields.find((field) => field.key === key)?.id
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
