import { createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { createRoomSchema } from '../../utils/validation'
import { roomCode } from '../../utils/slug'
import { readZodBody } from '../../utils/body'

async function uniqueRoomCode() {
  let code = roomCode()
  while (await prisma.room.findUnique({ where: { code } })) {
    code = roomCode()
  }
  return code
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await readZodBody(event, createRoomSchema)
  const system = await prisma.system.findUnique({ where: { id: input.systemId } })

  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'Sistema nao encontrado.' })
  }
  if (system.createdById !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Use apenas sistemas do seu inventario para criar salas.' })
  }
  if (system.moderationStatus !== 'APPROVED') {
    throw createError({ statusCode: 403, statusMessage: 'Este conteudo ainda esta em analise e nao pode ser usado em sessoes.' })
  }

  if (input.characterId) {
    const character = await prisma.character.findFirst({
      where: { id: input.characterId, userId: user.id },
      include: { system: true }
    })
    if (!character?.systemId || !character.system || !compatibleSystem(character.systemId, character.system.schemaJson as Record<string, any>, input.systemId)) {
      throw createError({ statusCode: 400, statusMessage: 'Escolha um personagem compativel com um sistema ativo do seu inventario.' })
    }
    if (character.moderationStatus !== 'APPROVED') {
      throw createError({ statusCode: 403, statusMessage: 'Este conteudo ainda esta em analise e nao pode ser usado em sessoes.' })
    }
  }

  const room = await prisma.room.create({
    data: {
      name: input.name,
      description: input.description,
      systemId: input.systemId,
      masterId: user.id,
      isPublic: input.isPublic,
      code: await uniqueRoomCode(),
      members: {
        create: {
          userId: user.id,
          characterId: input.characterId,
          role: 'MASTER'
        }
      }
    },
    include: {
      system: true,
      master: { select: { id: true, name: true } },
      members: { include: { character: true, user: { select: { id: true, name: true } } } }
    }
  })

  return { room }
})

function compatibleSystem(characterSystemId: string | null, schema: Record<string, any>, roomSystemId: string) {
  return characterSystemId === roomSystemId || schema?.provenance?.sourceSystemId === roomSystemId
}

