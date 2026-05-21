import { getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { assertActionCooldown } from '../../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const systemId = getRouterParam(event, 'id') || ''
  assertActionCooldown(`system-like:${user.id}:${systemId}`)
  const existing = await prisma.systemLike.findUnique({ where: { systemId_userId: { systemId, userId: user.id } } })

  if (existing) {
    await prisma.systemLike.delete({ where: { id: existing.id } })
    return { liked: false }
  }

  await prisma.systemLike.create({ data: { systemId, userId: user.id } })
  return { liked: true }
})
