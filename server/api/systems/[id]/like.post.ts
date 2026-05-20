import { getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const systemId = getRouterParam(event, 'id') || ''
  const existing = await prisma.systemLike.findUnique({ where: { systemId_userId: { systemId, userId: user.id } } })

  if (existing) {
    await prisma.systemLike.delete({ where: { id: existing.id } })
    return { liked: false }
  }

  await prisma.systemLike.create({ data: { systemId, userId: user.id } })
  return { liked: true }
})
