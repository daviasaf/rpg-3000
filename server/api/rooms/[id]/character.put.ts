import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { requireRoomAccess } from '../../../utils/permissions'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  characterId: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'id') || ''
  const room = await requireRoomAccess(roomId, user.id)
  const input = schema.parse(await readBody(event))

  const character = await prisma.character.findFirst({
    where: { id: input.characterId, userId: user.id, systemId: room.systemId }
  })

  if (!character) {
    throw createError({ statusCode: 400, statusMessage: 'Escolha um personagem compativel com o sistema da sala.' })
  }

  const member = await prisma.roomMember.update({
    where: { roomId_userId: { roomId, userId: user.id } },
    data: { characterId: character.id },
    include: { character: true }
  })

  return { member }
})
