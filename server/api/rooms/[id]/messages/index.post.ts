import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { requireRoomAccess } from '../../../../utils/permissions'
import { prisma } from '../../../../utils/prisma'
import { messageSchema } from '../../../../utils/validation'
import { jsonValue } from '../../../../utils/json'
import { readZodBody } from '../../../../utils/body'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'id') || ''
  const room = await requireRoomAccess(roomId, user.id)
  const input = await readZodBody(event, messageSchema)

  const isPlayerFieldRequest = input.type === 'EVENT' && input.metadataJson?.action === 'PLAYER_FIELD_CHANGE_REQUEST'
  const isPlayerSheetUpdateResponse = input.type === 'EVENT' && input.metadataJson?.action === 'PLAYER_SHEET_UPDATE_RESPONSE'

  if ((input.type === 'SYSTEM' || input.type === 'EVENT') && room.masterId !== user.id && !isPlayerFieldRequest && !isPlayerSheetUpdateResponse) {
    throw createError({ statusCode: 403, statusMessage: 'Apenas o mestre pode enviar eventos do sistema.' })
  }

  let metadata = input.metadataJson

  if (input.type === 'PRIVATE') {
    const rawTargets = metadata?.targetUserId
      ? [metadata.targetUserId]
      : Array.isArray(metadata?.recipientUserIds)
        ? metadata.recipientUserIds
        : []
    const targetUserIds = [...new Set(rawTargets.map(String).filter((id) => id && id !== user.id))]

    if (targetUserIds.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Escolha uma pessoa para a DM.' })
    }

    const targetMembers = await prisma.roomMember.findMany({
      where: { roomId, userId: { in: targetUserIds } },
      select: { userId: true }
    })

    if (targetMembers.length !== targetUserIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'A pessoa escolhida nao esta nesta sala.' })
    }

    metadata = {
      ...metadata,
      recipientUserIds: [user.id, ...targetUserIds],
      targetUserId: targetUserIds[0]
    }
  }

  if (input.characterId) {
    const member = await prisma.roomMember.findFirst({
      where: { roomId, userId: user.id, characterId: input.characterId }
    })
    if (!member && room.masterId !== user.id) {
      throw createError({ statusCode: 403, statusMessage: 'Este personagem nao esta vinculado a voce nesta sala.' })
    }
  }

  const session = await prisma.session.findFirst({ where: { roomId, status: 'ACTIVE' } })
  const message = await prisma.chatMessage.create({
    data: {
      roomId,
      sessionId: session?.id,
      userId: user.id,
      characterId: input.characterId,
      type: input.type,
      content: input.content,
      metadataJson: metadata ? jsonValue(metadata) : undefined
    },
    include: {
      user: { select: { id: true, name: true, profileColor: true } },
      character: { select: { id: true, name: true, avatarUrl: true } }
    }
  })

  return { message }
})
