import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../../../utils/auth'
import { prisma } from '../../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'commentId') || ''
  const comment = await prisma.profileComment.findUnique({
    where: { id },
    include: { post: { select: { userId: true } } }
  })

  if (!comment) throw createError({ statusCode: 404, statusMessage: 'Comentario nao encontrado.' })
  const canDelete = comment.userId === user.id || comment.post.userId === user.id
  if (!canDelete) throw createError({ statusCode: 403, statusMessage: 'Voce nao pode apagar este comentario.' })

  await prisma.profileComment.delete({ where: { id } })
  return { ok: true }
})

