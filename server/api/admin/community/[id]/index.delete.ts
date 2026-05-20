import { createError, getRouterParam } from 'h3'
import { requireAdmin } from '../../../../utils/adminAuth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const post = await prisma.communityPost.findUnique({ where: { id } })

  if (!post) throw createError({ statusCode: 404, statusMessage: 'Publicacao nao encontrada.' })

  await prisma.communityPost.delete({ where: { id } })
  return { ok: true }
})
