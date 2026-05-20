import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { requireRoomAccess } from '../../../utils/permissions'
import { prisma } from '../../../utils/prisma'
import { jsonValue } from '../../../utils/json'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const messageId = getRouterParam(event, 'messageId') || ''
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } })

  if (!message) throw createError({ statusCode: 404, statusMessage: 'Publicacao nao encontrada.' })
  await requireRoomAccess(message.roomId, user.id)

  const metadata = message.metadataJson && typeof message.metadataJson === 'object' && !Array.isArray(message.metadataJson) ? message.metadataJson : {}
  const likes = Array.isArray((metadata as { likes?: unknown }).likes) ? (metadata as { likes: unknown[] }).likes.map(String) : []
  const nextLikes = likes.includes(user.id) ? likes.filter((id) => id !== user.id) : [...likes, user.id]

  const updated = await prisma.chatMessage.update({
    where: { id: message.id },
    data: { metadataJson: jsonValue({ ...metadata, likes: nextLikes }) }
  })

  return { message: updated }
})
