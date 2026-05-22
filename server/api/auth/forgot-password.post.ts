import { randomBytes, createHash } from 'node:crypto'
import { prisma } from '../../utils/prisma'
import { forgotPasswordSchema } from '../../utils/validation'
import { sendPasswordResetEmail } from '../../utils/mailer'
import { createError } from 'h3'
import { readZodBody } from '../../utils/body'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export default defineEventHandler(async (event) => {
  const input = await readZodBody(event, forgotPasswordSchema)
  const user = await prisma.user.findUnique({ where: { email: input.email } })

  if (!user) {
    return { ok: true, message: 'Se o email existir, enviaremos instrucoes.' }
  }

  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60)

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  })

  const config = useRuntimeConfig()
  const resetUrl = `${config.public.appUrl}/reset-password?token=${token}`
  let email
  try {
    email = await sendPasswordResetEmail(user.email, resetUrl)
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Nao foi possivel enviar o email. Confira GMAIL_USER e GMAIL_PASS.'
    })
  }

  return {
    ok: true,
    message: 'Se o email existir, enviaremos instrucoes.',
    resetUrl: !email.sent && config.public.appUrl.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/)
      ? resetUrl
      : undefined
  }
})

