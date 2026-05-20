import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../../utils/auth'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const profileId = getRouterParam(event, 'id') || ''
  const id = getRouterParam(event, 'commentId') || ''
  const comment = await prisma.profileWallComment.findUnique({ where: { id } })

  if (!comment || comment.profileId !== profileId) {
    throw createError({ statusCode: 404, statusMessage: 'Comentario nao encontrado.' })
  }

  const canDelete = comment.userId === user.id || comment.profileId === user.id
  if (!canDelete) throw createError({ statusCode: 403, statusMessage: 'Voce nao pode apagar este comentario.' })

  await prisma.profileWallComment.delete({ where: { id } })
  return { ok: true }
})
