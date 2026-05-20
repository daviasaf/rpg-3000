import type { H3Event } from 'h3'
import { createError, deleteCookie, getCookie, getRequestURL, setCookie } from 'h3'
import { compare, hash } from 'bcryptjs'
import { jwtVerify, SignJWT } from 'jose'
import { prisma } from './prisma'

const cookieName = 'central_rpg_session'

export interface AuthUser {
  id: string
  name: string
  username: string | null
  email: string
  avatarUrl: string | null
  profileColor: string
}

function getSecret() {
  const config = useRuntimeConfig()
  return new TextEncoder().encode(config.jwtSecret)
}

export async function hashPassword(password: string) {
  return hash(password, 12)
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash)
}

export async function setAuthCookie(event: H3Event, userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())

  setCookie(event, cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getRequestURL(event).protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  })
}

export function clearAuthCookie(event: H3Event) {
  deleteCookie(event, cookieName, { path: '/' })
}

export async function getAuthUser(event: H3Event): Promise<AuthUser | null> {
  const token = getCookie(event, cookieName)
  if (!token) return null

  try {
    const payload = await jwtVerify(token, getSecret())
    const userId = payload.payload.sub
    if (!userId) return null

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, username: true, email: true, avatarUrl: true, profileColor: true }
    })

    return user
  } catch {
    clearAuthCookie(event)
    return null
  }
}

export async function requireAuth(event: H3Event) {
  const user = await getAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Voce precisa entrar para continuar.' })
  }

  return user
}
