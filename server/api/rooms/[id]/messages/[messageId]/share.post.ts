import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../../utils/auth'
import { requireRoomAccess } from '../../../../../utils/permissions'
import { prisma } from '../../../../../utils/prisma'
import { jsonValue } from '../../../../../utils/json'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'id') || ''
  const messageId = getRouterParam(event, 'messageId') || ''
  await requireRoomAccess(roomId, user.id)

  const message = await prisma.chatMessage.findFirst({ where: { id: messageId, roomId } })

  if (!message) {
    throw createError({ statusCode: 404, statusMessage: 'Mensagem nao encontrada.' })
  }

  if (!['SYSTEM', 'EVENT', 'ROLL'].includes(message.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Apenas mensagens do sistema podem ser compartilhadas.' })
  }

  const currentMetadata = message.metadataJson && typeof message.metadataJson === 'object' && !Array.isArray(message.metadataJson)
    ? message.metadataJson
    : {}

  const updated = await prisma.chatMessage.update({
    where: { id: message.id },
    data: {
      metadataJson: jsonValue({
        ...currentMetadata,
        shared: true,
        sharedAt: new Date().toISOString(),
        sharedByUserId: user.id
      })
    }
  })

  return { message: updated }
})
