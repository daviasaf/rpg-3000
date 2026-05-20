import type { H3Event } from 'h3'
import { createError, deleteCookie, getCookie, getRequestURL, setCookie } from 'h3'
import { jwtVerify, SignJWT } from 'jose'

const cookieName = 'central_rpg_admin'

function getSecret() {
  const config = useRuntimeConfig()
  return new TextEncoder().encode(config.jwtSecret)
}

export function adminPassword() {
  return process.env.ADMIN_SENHA || useRuntimeConfig().adminSenha || ''
}

export async function setAdminCookie(event: H3Event) {
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret())

  setCookie(event, cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getRequestURL(event).protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 8
  })
}

export function clearAdminCookie(event: H3Event) {
  deleteCookie(event, cookieName, { path: '/' })
}

export async function requireAdmin(event: H3Event) {
  const token = getCookie(event, cookieName)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Admin precisa entrar.' })
  }

  try {
    const payload = await jwtVerify(token, getSecret())
    if (payload.payload.admin !== true) throw new Error('not admin')
    return true
  } catch {
    clearAdminCookie(event)
    throw createError({ statusCode: 401, statusMessage: 'Sessao admin expirada.' })
  }
}
