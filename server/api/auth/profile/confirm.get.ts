import { createHash } from 'node:crypto'
import { createError, getQuery, sendRedirect } from 'h3'
import { prisma } from '../../../utils/prisma'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).token || '')
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token ausente.' })
  }

  const change = await prisma.profileChangeToken.findFirst({
    where: {
      tokenHash: hashToken(token),
      usedAt: null,
      expiresAt: { gt: new Date() }
    }
  })

  if (!change) {
    throw createError({ statusCode: 400, statusMessage: 'Token invalido ou expirado.' })
  }

  const payload = change.payloadJson as Record<string, unknown>

  await prisma.$transaction([
    prisma.user.update({
      where: { id: change.userId },
      data: {
        name: typeof payload.name === 'string' ? payload.name : undefined,
        username: typeof payload.username === 'string' ? payload.username : undefined,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        passwordHash: typeof payload.passwordHash === 'string' ? payload.passwordHash : undefined
      }
    }),
    prisma.profileChangeToken.update({
      where: { id: change.id },
      data: { usedAt: new Date() }
    })
  ])

  return sendRedirect(event, '/app/settings?verified=1')
})
