import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { publishCharacterSnapshot } from '../../../utils/community'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const character = await prisma.character.findUnique({ where: { id } })

  if (!character) throw createError({ statusCode: 404, statusMessage: 'Personagem nao encontrado.' })
  if (character.userId !== user.id) throw createError({ statusCode: 403, statusMessage: 'Voce so pode publicar seus personagens.' })
  if (character.moderationStatus === 'REJECTED') throw createError({ statusCode: 403, statusMessage: 'Personagem rejeitado nao pode ser republicado por edicao. Crie uma nova versao.' })

  await prisma.character.update({ where: { id }, data: { moderationStatus: 'PENDING', moderationReason: null } })
  const post = await publishCharacterSnapshot(id, user.id)
  return { post }
})
