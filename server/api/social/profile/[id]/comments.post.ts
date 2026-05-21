import { createError, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../../utils/auth'
import { readZodBody } from '../../../../utils/body'
import { prisma } from '../../../../utils/prisma'

const schema = z.object({
  content: z.string().trim().min(1, 'Escreva um comentario.').max(600, 'Comentario muito longo.')
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const profileId = getRouterParam(event, 'id') || ''
  const input = await readZodBody(event, schema)
  const profile = await prisma.user.findUnique({ where: { id: profileId }, select: { id: true } })

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Perfil nao encontrado.' })
  }
  if (profileId === user.id) {
    throw createError({ statusCode: 403, statusMessage: 'O perfil mostra comentarios recebidos de outras pessoas.' })
  }

  const comment = await prisma.profileWallComment.create({
    data: {
      profileId,
      userId: user.id,
      content: input.content
    },
    include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true } } }
  })

  return { comment }
})
