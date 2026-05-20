import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { withPrismaErrors } from '../../utils/prismaErrors'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const rooms = await withPrismaErrors(() => prisma.room.findMany({
    where: {
      OR: [
        { masterId: user.id },
        { members: { some: { userId: user.id } } }
      ]
    },
    include: {
      system: { select: { id: true, name: true, schemaJson: true } },
      master: { select: { id: true, name: true } },
      members: { include: { character: true, user: { select: { id: true, name: true } } } },
      _count: { select: { members: true } }
    },
    orderBy: { updatedAt: 'desc' }
  }))

  return { rooms }
})
