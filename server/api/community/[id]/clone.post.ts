import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { jsonValue, nullableJsonValue } from '../../../utils/json'
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
  const post = await prisma.communityPost.findFirst({ where: { id, status: 'APPROVED' } })

  if (!post) throw createError({ statusCode: 404, statusMessage: 'Publicacao nao encontrada.' })

  const snapshot = post.snapshotJson as Record<string, any>

  if (post.type === 'SYSTEM') {
    const system = await prisma.system.create({
      data: {
        name: `${post.title} (copia)`,
        slug: await createUniqueSlug(`${post.title} copia`),
        description: post.description || '',
        avatarUrl: post.avatarUrl,
        tags: post.tags,
        visibility: 'PRIVATE',
        moderationStatus: 'APPROVED',
        createdById: user.id,
        schemaJson: jsonValue(snapshot.schemaJson || {}),
        fields: {
          create: Array.isArray(snapshot.fields)
            ? snapshot.fields.map((field: Record<string, any>, index: number) => ({
                key: field.key,
                label: field.label,
                type: field.type,
                category: field.category,
                defaultValue: nullableJsonValue(field.defaultValue),
                optionsJson: nullableJsonValue(field.optionsJson),
                formula: field.formula,
                order: field.order ?? index
              }))
            : []
        }
      }
    })
    return { system }
  }

  if (post.type === 'NPC') {
    const npc = await prisma.npc.create({
      data: {
        name: post.title,
        description: post.description,
        avatarUrl: post.avatarUrl,
        systemId: typeof snapshot.systemId === 'string' ? snapshot.systemId : null,
        isCommunity: false,
        moderationStatus: 'APPROVED',
        createdById: user.id,
        dataJson: jsonValue(snapshot.dataJson || {})
      }
    })
    return { npc }
  }

  if (post.type === 'CHARACTER') {
    const systemId = typeof snapshot.systemId === 'string' ? snapshot.systemId : ''
    const system = await prisma.system.findUnique({ where: { id: systemId }, include: { fields: true } })
    if (!system) throw createError({ statusCode: 400, statusMessage: 'Sistema original indisponivel para copiar este personagem.' })

    const dataJson = snapshot.dataJson || {}
    const character = await prisma.character.create({
      data: {
        name: post.title,
        description: post.description,
        avatarUrl: post.avatarUrl,
        userId: user.id,
        systemId,
        dataJson: jsonValue(dataJson),
        values: {
          create: Object.entries(dataJson).map(([key, value]) => ({
            key,
            valueJson: jsonValue(value),
            fieldId: system.fields.find((field) => field.key === key)?.id
          }))
        }
      }
    })
    return { character }
  }

  throw createError({ statusCode: 400, statusMessage: 'Tipo de publicacao invalido.' })
})
