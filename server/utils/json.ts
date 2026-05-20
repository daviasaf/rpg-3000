import { Prisma } from '@prisma/client'

export function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export function nullableJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined
  if (value === null) return Prisma.JsonNull
  return jsonValue(value)
}
