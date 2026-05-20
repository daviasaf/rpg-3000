import { createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { joinRoomSchema } from '../../utils/validation'
import { readZodBody } from '../../utils/body'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await readZodBody(event, joinRoomSchema)
  const room = await prisma.room.findUnique({ where: { code: input.code } })

  if (!room) {
    throw createError({ statusCode: 404, statusMessage: 'Codigo de sala nao encontrado.' })
  }

  const character = await prisma.character.findFirst({
    where: { id: input.characterId, userId: user.id, systemId: room.systemId }
  })

  if (!character) {
    throw createError({ statusCode: 400, statusMessage: 'Escolha um personagem compativel com a sala.' })
  }

  const existingMember = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: room.id, userId: user.id } }
  })

  const member = await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId: user.id } },
    update: { characterId: character.id },
    create: {
      roomId: room.id,
      userId: user.id,
      characterId: character.id,
      role: room.masterId === user.id ? 'MASTER' : 'PLAYER'
    }
  })

  if (!existingMember) {
    await prisma.chatMessage.create({
      data: {
        roomId: room.id,
        userId: user.id,
        characterId: character.id,
        type: 'SYSTEM',
        content: `${character.name} entrou na sessao.`
      }
    })
  }

  return { roomId: room.id, member }
})
