import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'commentId') || ''
  const comment = await prisma.systemComment.findUnique({ where: { id } })

  if (!comment) throw createError({ statusCode: 404, statusMessage: 'Comentario nao encontrado.' })
  if (comment.userId !== user.id) throw createError({ statusCode: 403, statusMessage: 'Voce so pode apagar seu comentario.' })

  await prisma.systemComment.delete({ where: { id } })
  return { ok: true }
})
