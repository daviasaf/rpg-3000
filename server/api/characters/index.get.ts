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

  return { characters: characters.map(withSystemFallback) }
})

function withSystemFallback(character: any) {
  if (character.system) return character
  const snapshot = character.systemSnapshotJson as any
  return {
    ...character,
    system: {
      id: null,
      name: snapshot?.name || character.dataJson?.__meta?.systemName || 'Sistema removido',
      slug: '',
      schemaJson: snapshot?.schemaJson || {},
      unavailable: true
    }
  }
}
