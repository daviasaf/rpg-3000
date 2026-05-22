import { createError, getRouterParam } from 'h3'
import { z } from 'zod'
import { readZodBody } from '../../../utils/body'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { assertActionCooldown } from '../../../utils/rateLimit'

const schema = z.object({
  content: z.string().trim().min(1, 'Escreva um comentario.').max(600, 'Comentario muito longo.')
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const postId = getRouterParam(event, 'id') || ''
  assertActionCooldown(`community-comment:${user.id}:${postId}`, 1500)
  const input = await readZodBody(event, schema)
  const post = await prisma.communityPost.findFirst({ where: { id: postId, status: 'APPROVED' } })

  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Publicacao nao encontrada.' })
  }

  const comment = await prisma.communityPostComment.create({
    data: { postId, userId: user.id, content: input.content },
    include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true } } }
  })

  return { comment }
})

