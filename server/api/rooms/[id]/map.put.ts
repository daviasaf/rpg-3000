import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { requireRoomAccess } from '../../../utils/permissions'
import { prisma } from '../../../utils/prisma'
import { jsonValue } from '../../../utils/json'

const tokenSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  avatarUrl: z.string().trim().url().optional().or(z.literal('')).nullable(),
  color: z.string().trim().max(32).optional().nullable(),
  kind: z.enum(['CHARACTER', 'NPC', 'MARKER']).default('MARKER'),
  x: z.number().int().min(0).max(31),
  y: z.number().int().min(0).max(31),
  previousX: z.number().int().min(0).max(31).optional().nullable(),
  previousY: z.number().int().min(0).max(31).optional().nullable()
})

const schema = z.object({
  columns: z.number().int().min(8).max(24).default(14),
  rows: z.number().int().min(6).max(16).default(10),
  tokens: z.array(tokenSchema).max(80).default([]),
  movedTokenId: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'id') || ''
  const access = await requireRoomAccess(roomId, user.id)
  const input = schema.parse(await readBody(event))
  const isMaster = access.masterId === user.id
  const movedToken = input.movedTokenId ? input.tokens.find((token) => token.id === input.movedTokenId) : null

  if (input.tokens.some((token) => token.x >= input.columns || token.y >= input.rows)) {
    throw createError({ statusCode: 400, statusMessage: 'Token fora da grade.' })
  }

  if (!isMaster) {
    const member = await prisma.roomMember.findFirst({ where: { roomId, userId: user.id, characterId: movedToken?.id || '' } })
    if (!member) {
      throw createError({ statusCode: 403, statusMessage: 'Voce so pode mover seu proprio token.' })
    }
  }

  const previousMap = access.mapJson as { tokens?: Array<{ id: string; name: string; x: number; y: number }> } | null
  const previousToken = movedToken ? previousMap?.tokens?.find((token) => token.id === movedToken.id) : null
  const didMove = Boolean(movedToken && previousToken && (previousToken.x !== movedToken.x || previousToken.y !== movedToken.y))
  const mapState = {
    columns: input.columns,
    rows: input.rows,
    tokens: input.tokens.map((token) => token.id === movedToken?.id && didMove
      ? { ...token, previousX: previousToken?.x ?? token.previousX ?? null, previousY: previousToken?.y ?? token.previousY ?? null }
      : token)
  }

  const room = await prisma.$transaction(async (tx) => {
    const updated = await tx.room.update({
      where: { id: roomId },
      data: { mapJson: jsonValue(mapState) },
      select: { id: true, mapJson: true }
    })

    if (didMove && movedToken) {
      const session = await tx.session.findFirst({ where: { roomId, status: 'ACTIVE' } })
      const actor = isMaster ? 'pelo mestre' : `por ${user.name}`
      await tx.chatMessage.create({
        data: {
          roomId,
          sessionId: session?.id,
          userId: user.id,
          type: 'SYSTEM',
          content: `${movedToken.name} se moveu no mapa ${actor}.`,
          metadataJson: jsonValue({
            action: 'MAP_TOKEN_MOVED',
            tokenId: movedToken.id,
            tokenName: movedToken.name,
            from: { x: previousToken?.x, y: previousToken?.y },
            to: { x: movedToken.x, y: movedToken.y }
          })
        }
      })
    }

    return updated
  })

  return { map: room.mapJson }
})
