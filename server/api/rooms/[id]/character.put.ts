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
  const roomSystem = await prisma.system.findUnique({ where: { id: room.systemId } })
  if (roomSystem?.moderationStatus !== 'APPROVED') {
    throw createError({ statusCode: 403, statusMessage: 'Este conteudo ainda esta em analise e nao pode ser usado em sessoes.' })
  }
  const input = schema.parse(await readBody(event))

  const character = await prisma.character.findFirst({
    where: { id: input.characterId, userId: user.id },
    include: { system: true }
  })

  if (!character || !compatibleSystem(character.systemId, character.system.schemaJson as Record<string, any>, room.systemId)) {
    throw createError({ statusCode: 400, statusMessage: 'Escolha um personagem compativel com o sistema da sala.' })
  }
  if (character.moderationStatus !== 'APPROVED') {
    throw createError({ statusCode: 403, statusMessage: 'Este conteudo ainda esta em analise e nao pode ser usado em sessoes.' })
  }

  const member = await prisma.roomMember.update({
    where: { roomId_userId: { roomId, userId: user.id } },
    data: { characterId: character.id },
    include: { character: true }
  })

  return { member }
})

function compatibleSystem(characterSystemId: string, schema: Record<string, any>, roomSystemId: string) {
  return characterSystemId === roomSystemId || schema?.provenance?.sourceSystemId === roomSystemId
}
