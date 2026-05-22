import { getRouterParam } from 'h3'
import { requireAuth } from '../../../../../utils/auth'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const postId = getRouterParam(event, 'id') || ''
  const existing = await prisma.profileLike.findUnique({ where: { postId_userId: { postId, userId: user.id } } })

  if (existing) {
    await prisma.profileLike.delete({ where: { id: existing.id } })
    return { liked: false }
  }

  await prisma.profileLike.create({ data: { postId, userId: user.id } })
  return { liked: true }
})

