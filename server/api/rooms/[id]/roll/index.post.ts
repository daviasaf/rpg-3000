import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { requireRoomAccess } from '../../../../utils/permissions'
import { prisma } from '../../../../utils/prisma'
import { parseAndRollDice } from '../../../../utils/dice'
import { diceRollSchema } from '../../../../utils/validation'
import { jsonValue } from '../../../../utils/json'
import { readZodBody } from '../../../../utils/body'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'id') || ''
  const room = await requireRoomAccess(roomId, user.id)
  const input = await readZodBody(event, diceRollSchema)

  let characterName: string | null = null
  if (input.characterId) {
    const member = await prisma.roomMember.findFirst({
      where: { roomId, characterId: input.characterId }
    })
    if (!member || (member.userId !== user.id && room.masterId !== user.id)) {
      throw createError({ statusCode: 403, statusMessage: 'Personagem indisponivel para rolagem.' })
    }
    const character = await prisma.character.findUnique({ where: { id: input.characterId } })
    characterName = character?.name ?? null
  }

  let dice
  try {
    dice = parseAndRollDice(input.expression, input.mode)
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
    : `${actor} rolou ${dice.expression}. ${formatDiceResult(dice)}`

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

function formatDiceResult(dice: ReturnType<typeof parseAndRollDice>) {
  const rollText = dice.rolls
    .map((roll, index) => {
      const label = dice.rolls.length > 1 ? `rolagem ${index + 1}` : `${roll.count}d${roll.sides}`
      return `${label}: ${roll.values.join(', ')}`
    })
    .join(' | ')

  const modifier = dice.modifier === 0 ? '' : `, modificador ${dice.modifier > 0 ? '+' : ''}${dice.modifier}`

  if (dice.mode === 'ADVANTAGE_EXPRESSION') {
    const values = dice.rolls[0]?.values || []
    return `Resultado: ${dice.result} (${values.join(', ')}, maior ${Math.max(...values)}${modifier}).`
  }

  if (dice.mode === 'ADVANTAGE' || dice.mode === 'DISADVANTAGE') {
    const chosen = dice.mode === 'ADVANTAGE' ? 'maior' : 'menor'
    return `Resultado: ${dice.result} (${rollText}, escolhido o ${chosen}${modifier}).`
  }

  return `Resultado: ${dice.result} (${rollText}${modifier}).`
}
