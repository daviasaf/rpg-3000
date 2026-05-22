import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const rooms = await prisma.room.findMany({
    where: {
      OR: [
        { masterId: user.id },
        { members: { some: { userId: user.id } } }
      ]
    },
    select: { id: true }
  })

  const roomIds = rooms.map((room) => room.id)
  if (roomIds.length === 0) return { items: [] }

  const messages = await prisma.chatMessage.findMany({
    where: {
      roomId: { in: roomIds },
      type: { in: ['SYSTEM', 'EVENT', 'ROLL'] }
    },
    include: {
      room: { select: { id: true, name: true, system: { select: { name: true } } } }
    },
    orderBy: { createdAt: 'desc' },
    take: 120
  })

  const items = messages
    .filter((message) => {
      const metadata = message.metadataJson
      return Boolean(metadata && typeof metadata === 'object' && !Array.isArray(metadata) && (metadata as { shared?: unknown }).shared)
    })
    .slice(0, 8)

  const likeUserIds = [...new Set(items.flatMap((message) => {
    const metadata = message.metadataJson
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
    const likes = (metadata as { likes?: unknown }).likes
    return Array.isArray(likes) ? likes.map(String) : []
  }))]
  const likeUsers = likeUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: likeUserIds } },
        select: { id: true, name: true, avatarUrl: true, profileColor: true }
      })
    : []
  const usersById = new Map(likeUsers.map((user) => [user.id, user]))
  const enrichedItems = items.map((message) => {
    const metadata = message.metadataJson
    const likes = metadata && typeof metadata === 'object' && !Array.isArray(metadata) && Array.isArray((metadata as { likes?: unknown }).likes)
      ? (metadata as { likes: unknown[] }).likes.map(String)
      : []

    return {
      ...message,
      likeUsers: likes.map((id) => usersById.get(id)).filter(Boolean)
    }
  })

  return { items: enrichedItems, userId: user.id }
})

