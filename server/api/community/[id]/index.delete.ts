import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''

  const post = await prisma.communityPost.findUnique({
    where: { id },
    select: { id: true, authorId: true, title: true }
  })

  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Publicacao nao encontrada.' })
  }

  if (post.authorId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Voce so pode apagar publicacoes criadas por voce.' })
  }

  await prisma.communityPost.delete({ where: { id } })

  return { ok: true, deletedPost: { id: post.id, title: post.title } }
})
