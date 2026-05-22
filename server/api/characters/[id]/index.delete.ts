import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const character = await prisma.character.findUnique({ where: { id } })

  if (!character) {
    throw createError({ statusCode: 404, statusMessage: 'Personagem nao encontrado.' })
  }

  if (character.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Voce so pode excluir seus personagens.' })
  }

  await prisma.character.delete({ where: { id } })
  return { ok: true }
})

