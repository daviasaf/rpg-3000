import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const character = await prisma.character.findUnique({
    where: { id },
    include: {
      system: { include: { fields: { orderBy: { order: 'asc' } } } },
      values: true
    }
  })

  if (!character) {
    throw createError({ statusCode: 404, statusMessage: 'Personagem nao encontrado.' })
  }

  const membership = await prisma.roomMember.findFirst({
    where: { characterId: id, room: { masterId: user.id } }
  })

  if (character.userId !== user.id && !membership) {
    throw createError({ statusCode: 403, statusMessage: 'Voce nao tem acesso a esta ficha.' })
  }

  return { character: withSystemFallback(character) }
})

function withSystemFallback(character: any) {
  if (character.system) return character
  const snapshot = character.systemSnapshotJson as any
  return {
    ...character,
    system: {
      id: null,
      name: snapshot?.name || character.dataJson?.__meta?.systemName || 'Sistema removido',
      slug: '',
      schemaJson: snapshot?.schemaJson || character.dataJson?.__meta?.systemSnapshot?.schemaJson || {},
      fields: Array.isArray(snapshot?.fields) ? snapshot.fields : [],
      unavailable: true
    }
  }
}
