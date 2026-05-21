import { getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { assertActionCooldown } from '../../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const postId = getRouterParam(event, 'id') || ''
  assertActionCooldown(`community-like:${user.id}:${postId}`)
  const existing = await prisma.communityPostLike.findUnique({ where: { postId_userId: { postId, userId: user.id } } })

  if (existing) {
    await prisma.communityPostLike.delete({ where: { id: existing.id } })
    return { liked: false }
  }

  await prisma.communityPostLike.create({ data: { postId, userId: user.id } })
  return { liked: true }
})
