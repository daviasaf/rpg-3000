import { createError, readBody } from 'h3'
import { adminPassword, setAdminCookie } from '../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ password?: string }>(event)
  const password = adminPassword()

  if (!password || body?.password !== password) {
    throw createError({ statusCode: 401, statusMessage: 'Senha admin invalida.' })
  }

  await setAdminCookie(event)
  return { ok: true }
})
