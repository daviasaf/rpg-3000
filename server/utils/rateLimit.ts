import { createError } from 'h3'

type Store = Map<string, number>

const globalStore = globalThis as typeof globalThis & { __centralRpgRateLimit?: Store }
const store = globalStore.__centralRpgRateLimit || new Map<string, number>()
globalStore.__centralRpgRateLimit = store

export function assertActionCooldown(key: string, windowMs = 900) {
  const now = Date.now()
  const last = store.get(key) || 0

  if (now - last < windowMs) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Aguarde um instante antes de tentar novamente.'
    })
  }

  store.set(key, now)
}
