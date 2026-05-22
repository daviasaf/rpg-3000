import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { requireRoomAccess } from '../../../../utils/permissions'
import { prisma } from '../../../../utils/prisma'
import { parseAndRollDice } from '../../../../utils/dice'
import { diceRollSchema } from '../../../../utils/validation'
import { jsonValue } from '../../../../utils/json'
import { readZodBody } from '../../../../utils/body'
import { assertActionCooldown } from '../../../../utils/rateLimit'
import { characterFormulaValues, resolveFormulaExpression } from '~~/shared/utils/characterRules'
import { normalizeSheetTabs } from '~~/shared/utils/sheetTabs'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'id') || ''
  assertActionCooldown(`roll:${user.id}:${roomId}`, 900)
  const room = await requireRoomAccess(roomId, user.id)
  const input = await readZodBody(event, diceRollSchema)

  let characterName: string | null = null
  let expression = input.expression
  if (input.characterId) {
    const member = await prisma.roomMember.findFirst({
      where: { roomId, characterId: input.characterId }
    })
    if (!member || (member.userId !== user.id && room.masterId !== user.id)) {
      throw createError({ statusCode: 403, statusMessage: 'Personagem indisponivel para rolagem.' })
    }
    const character = await prisma.character.findUnique({
      where: { id: input.characterId },
      include: { system: { include: { fields: true } } }
    })
    characterName = character?.name ?? null
    if (character) {
      if (character.moderationStatus !== 'APPROVED' || character.system.moderationStatus !== 'APPROVED') {
        throw createError({ statusCode: 403, statusMessage: 'Este conteudo ainda esta em analise e nao pode ser usado em sessoes.' })
      }
      const values = characterFormulaValues(character.system.fields as any, normalizeSheetTabs(character.system.schemaJson as any), character.dataJson as Record<string, unknown>)
      const resolved = resolveFormulaExpression(input.expression, values)
      if (resolved.missing) throw createError({ statusCode: 400, statusMessage: `Chave "${resolved.missing}" nao existe na ficha.` })
      expression = compactDiceExpression(resolved.resolved)
    }
  }

  let dice
  try {
    dice = parseAndRollDice(expression, input.mode)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Rolagem invalida.'
    })
  }

  const session = await prisma.session.findFirst({ where: { roomId, status: 'ACTIVE' } })
  const actor = characterName || user.name
  const hidden = input.hidden && room.masterId === user.id
  const content = hidden
    ? `${actor} fez uma rolagem oculta. Resultado: ??`
    : `${actor} rolou ${dice.expression}.\n${formatDiceResult(dice)}`

  const result = await prisma.$transaction(async (tx) => {
    const roll = await tx.diceRoll.create({
      data: {
        roomId,
        sessionId: session?.id,
        userId: user.id,
        characterId: input.characterId,
        expression: dice.expression,
        result: dice.result,
        rollsJson: jsonValue(dice.rolls),
        modifier: dice.modifier,
        mode: dice.mode
      }
    })

    const message = await tx.chatMessage.create({
      data: {
        roomId,
        sessionId: session?.id,
        userId: user.id,
        characterId: input.characterId,
        type: 'ROLL',
        content,
        metadataJson: jsonValue({ diceRollId: roll.id, dice: hidden ? { expression: dice.expression, hidden: true } : dice, secretDice: hidden ? dice : undefined })
      },
      include: {
        user: { select: { id: true, name: true, profileColor: true } },
        character: { select: { id: true, name: true, avatarUrl: true } }
      }
    })

    return { roll, message }
  })

  return result
})

function compactDiceExpression(expression: string) {
  const normalized = expression.replace(/\s+/g, '')
  const match = normalized.match(/^(\d{1,3}d\d{1,4})(.*)$/i)
  if (!match) return normalized
  const modifier = (match[2] || '').match(/[+-]?\d+/g)?.reduce((sum, value) => sum + Number(value), 0) || 0
  return `${match[1]}${modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : modifier}`
}

function formatDiceResult(dice: ReturnType<typeof parseAndRollDice>) {
  const roll = dice.rolls[0]
  const values = roll?.values || []
  const subtotal = values.reduce((sum, value) => sum + value, 0)
  const lines = ['Resultados:']

  values.forEach((value, index) => {
    lines.push(`- Dado ${index + 1}: ${value}`)
  })

  lines.push(`Total dos dados: ${subtotal}`)
  if (dice.modifier) lines.push(`Modificador: ${dice.modifier > 0 ? '+' : ''}${dice.modifier}`)
  lines.push(`Resultado final: ${dice.result}`)

  return lines.join('\n')
}

