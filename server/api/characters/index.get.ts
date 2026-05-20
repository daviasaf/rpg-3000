import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { withPrismaErrors } from '../../utils/prismaErrors'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const characters = await withPrismaErrors(() => prisma.character.findMany({
    where: { userId: user.id },
    include: {
      system: { select: { id: true, name: true, slug: true, schemaJson: true } },
      values: true
    },
    orderBy: { updatedAt: 'desc' }
  }))

  return { characters }
})
