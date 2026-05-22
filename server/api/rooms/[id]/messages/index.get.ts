import { getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { requireRoomAccess } from '../../../../utils/permissions'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'id') || ''
  const room = await requireRoomAccess(roomId, user.id)

  const rawMessages = await prisma.chatMessage.findMany({
    where: { roomId },
    include: {
      user: { select: { id: true, name: true, profileColor: true } },
      character: { select: { id: true, name: true, avatarUrl: true } }
    },
    orderBy: { createdAt: 'asc' },
    take: 200
  })

  const messages = rawMessages.filter((message) => {
    if (message.type !== 'PRIVATE') return true
    if (message.userId === user.id) return true

    const metadata = message.metadataJson
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false

    const recipients = (metadata as { recipientUserIds?: unknown }).recipientUserIds
    return Array.isArray(recipients) && recipients.map(String).includes(user.id)
  }).map((message) => {
    const metadata = message.metadataJson
    if (room.masterId === user.id || !metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return message
    const { secretDice, ...safeMetadata } = metadata as Record<string, unknown>
    return { ...message, metadataJson: safeMetadata }
  })

  return { messages }
})

