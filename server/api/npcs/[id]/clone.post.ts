import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { jsonValue } from '../../../utils/json'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const source = await prisma.npc.findUnique({ where: { id } })

  if (!source) {
    throw createError({ statusCode: 404, statusMessage: 'NPC nao encontrado.' })
  }

  if (!source.isCommunity && source.createdById !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Este NPC nao pode ser adicionado.' })
  }

  const npc = await prisma.npc.create({
    data: {
      name: source.name,
      description: source.description,
      avatarUrl: source.avatarUrl,
      systemId: source.systemId,
      isCommunity: false,
      moderationStatus: 'APPROVED',
      createdById: user.id,
      dataJson: jsonValue(source.dataJson)
    },
    include: {
      system: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { likes: true, comments: true } }
    }
  })

  return { npc }
})

