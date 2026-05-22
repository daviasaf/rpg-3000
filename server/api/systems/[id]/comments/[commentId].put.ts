import { createError, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../../utils/auth'
import { readZodBody } from '../../../../utils/body'
import { prisma } from '../../../../utils/prisma'

const schema = z.object({ content: z.string().trim().min(1).max(500) })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'commentId') || ''
  const input = await readZodBody(event, schema)
  const comment = await prisma.systemComment.findUnique({ where: { id } })

  if (!comment) throw createError({ statusCode: 404, statusMessage: 'Comentario nao encontrado.' })
  if (comment.userId !== user.id) throw createError({ statusCode: 403, statusMessage: 'Voce so pode editar seu comentario.' })

  const updated = await prisma.systemComment.update({
    where: { id },
    data: { content: input.content },
    include: { user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } } }
  })

  return { comment: updated }
})

