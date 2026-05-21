import { createHash, randomBytes } from 'node:crypto'
import { createError } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { hashPassword, verifyPassword } from '../../utils/auth'
import { readZodBody } from '../../utils/body'
import { prisma } from '../../utils/prisma'
import { sendVerificationEmail } from '../../utils/mailer'
import { jsonValue } from '../../utils/json'

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome exibido.').max(80).optional(),
  username: z.string().trim().min(2, 'Informe o nome de usuario.').max(32).regex(/^[a-zA-Z0-9_.-]+$/, 'Use letras, numeros, ponto, hifen ou underline.').optional(),
  email: z.string().trim().email('Informe um email valido.').toLowerCase().optional(),
  avatarUrl: z.string().trim().url('Informe uma URL valida.').optional().or(z.literal('')).nullable(),
  profileColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'Use pelo menos 8 caracteres.').optional()
})

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await readZodBody(event, profileSchema)
  const current = await prisma.user.findUnique({ where: { id: user.id } })

  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Usuario nao encontrado.' })
  }

  const directData: { avatarUrl?: string | null; profileColor?: string } = {}
  if (input.avatarUrl !== undefined) directData.avatarUrl = input.avatarUrl || null
  if (input.profileColor) directData.profileColor = input.profileColor

  const sensitivePayload: Record<string, unknown> = {}
  if (input.name !== undefined && input.name !== current.name) sensitivePayload.name = input.name
  if (input.username !== undefined && input.username !== current.username) sensitivePayload.username = input.username
  if (input.email !== undefined && input.email !== current.email) sensitivePayload.email = input.email

  if (input.newPassword) {
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, current.passwordHash))) {
      throw createError({ statusCode: 400, statusMessage: 'Senha atual invalida.' })
    }
    sensitivePayload.passwordHash = await hashPassword(input.newPassword)
  }

  if (sensitivePayload.name || sensitivePayload.username || sensitivePayload.email) {
    const conflicts = await prisma.user.findFirst({
      where: {
        id: { not: user.id },
        OR: [
          sensitivePayload.name ? { name: String(sensitivePayload.name) } : undefined,
          sensitivePayload.username ? { username: String(sensitivePayload.username) } : undefined,
          sensitivePayload.email ? { email: String(sensitivePayload.email) } : undefined
        ].filter(Boolean) as Array<{ name?: string; username?: string; email?: string }>
      }
    })

    if (conflicts) {
      throw createError({ statusCode: 409, statusMessage: 'Nome exibido, usuario ou email ja esta em uso.' })
    }
  }

  if (Object.keys(directData).length) {
    await prisma.user.update({ where: { id: user.id }, data: directData })
  }

  let verificationUrl: string | undefined
  if (Object.keys(sensitivePayload).length) {
    const token = randomBytes(32).toString('hex')
    await prisma.profileChangeToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        type: sensitivePayload.passwordHash && Object.keys(sensitivePayload).length === 1 ? 'PASSWORD' : sensitivePayload.email ? 'EMAIL' : 'PROFILE',
        payloadJson: jsonValue(sensitivePayload),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60)
      }
    })

    const config = useRuntimeConfig()
    verificationUrl = `${config.public.appUrl}/api/auth/profile/confirm?token=${token}`
    try {
      await sendVerificationEmail(
        current.email,
        'Confirme alteracao de conta - Toca dos Nerds',
        verificationUrl,
        'Recebemos uma solicitacao para alterar dados sensiveis da sua conta.'
      )
    } catch {
      throw createError({ statusCode: 502, statusMessage: 'Nao foi possivel enviar o email de verificacao.' })
    }
  }

  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, username: true, email: true, avatarUrl: true, profileColor: true }
  })

  return {
    user: updated,
    pendingVerification: Object.keys(sensitivePayload).length > 0,
    verificationUrl: verificationUrl && useRuntimeConfig().public.appUrl.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/)
      ? verificationUrl
      : undefined
  }
})
