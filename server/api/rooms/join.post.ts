import { createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { joinRoomSchema } from '../../utils/validation'
import { readZodBody } from '../../utils/body'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await readZodBody(event, joinRoomSchema)
  const room = await prisma.room.findUnique({ where: { code: input.code }, include: { system: true } })

  if (!room) {
    throw createError({ statusCode: 404, statusMessage: 'Codigo de sala nao encontrado.' })
  }

  if (room.system.moderationStatus !== 'APPROVED') {
    throw createError({ statusCode: 403, statusMessage: 'Este conteudo ainda esta em analise e nao pode ser usado em sessoes.' })
  }

  const character = await prisma.character.findFirst({
    where: { id: input.characterId, userId: user.id },
    include: { system: true }
  })

  if (!character || !compatibleSystem(character.systemId, character.system.schemaJson as Record<string, any>, room.systemId)) {
    throw createError({ statusCode: 400, statusMessage: 'Escolha um personagem compativel com a sala.' })
  }
  if (character.moderationStatus !== 'APPROVED') {
    throw createError({ statusCode: 403, statusMessage: 'Este conteudo ainda esta em analise e nao pode ser usado em sessoes.' })
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

function compatibleSystem(characterSystemId: string, schema: Record<string, any>, roomSystemId: string) {
  return characterSystemId === roomSystemId || schema?.provenance?.sourceSystemId === roomSystemId
}

