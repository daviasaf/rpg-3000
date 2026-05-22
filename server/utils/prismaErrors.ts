import { createError } from 'h3'

type PrismaLikeError = {
  code?: string
  message?: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isDatabaseSchemaError(error: unknown) {
  if (!isObject(error)) return false

  const prismaError = error as PrismaLikeError
  const message = String(prismaError.message || '')

  return (
    prismaError.code === 'P2021' ||
    prismaError.code === 'P2022' ||
    message.includes('does not exist in the current database') ||
    message.includes('table public.') ||
    (message.includes('column') && message.includes('does not exist'))
  )
}

export function toFriendlyPrismaError(error: unknown): never {
  if (isDatabaseSchemaError(error)) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Banco de dados desatualizado. Rode npx prisma generate e npx prisma db push, depois reinicie o servidor.',
      data: {
        hint: 'O schema do Prisma mudou, mas o banco conectado pelo DATABASE_URL ainda nao foi atualizado.'
      }
    })
  }

  throw error
}

export async function withPrismaErrors<T>(action: () => Promise<T>) {
  try {
    return await action()
  } catch (error) {
    return toFriendlyPrismaError(error)
  }
}

