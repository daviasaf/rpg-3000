import type { DiceResult } from '../../shared/types/system'

const dicePattern = /^\s*(\d{1,3})d(\d{1,4})(?:\s*([+-])\s*(\d{1,4}))?\s*$/i

function rollOnce(count: number, sides: number) {
  const values = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
  const subtotal = values.reduce((total, value) => total + value, 0)
  return { count, sides, values, subtotal }
}

export function parseAndRollDice(expression: string, mode = 'NORMAL'): DiceResult {
  const normalized = expression.replace(/\s+/g, '')
  const match = normalized.match(dicePattern)
  if (!match) {
    throw new Error('Use expressoes como 1d20, 2d6+3 ou 1d100-10.')
  }

  const count = Number(match[1])
  const sides = Number(match[2])
  const sign = match[3] === '-' ? -1 : 1
  const modifier = match[4] ? Number(match[4]) * sign : 0

  if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
    throw new Error('Quantidade de dados ou lados fora do limite permitido.')
  }

  const roll = rollOnce(count, sides)
  return {
    expression: normalized,
    result: roll.subtotal + modifier,
    rolls: [roll],
    modifier,
    mode: 'NORMAL'
  }
}

