import { createHash } from 'node:crypto'
import { createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { resetPasswordSchema } from '../../utils/validation'
import { hashPassword } from '../../utils/auth'
import { readZodBody } from '../../utils/body'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export default defineEventHandler(async (event) => {
  const input = await readZodBody(event, resetPasswordSchema)
  const tokenHash = hashToken(input.token)
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() }
    }
  })

  if (!resetToken) {
    throw createError({ statusCode: 400, statusMessage: 'Token invalido ou expirado.' })
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: await hashPassword(input.password) }
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    })
  ])

  return { ok: true }
})

