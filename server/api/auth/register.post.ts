import { createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { hashPassword, setAuthCookie } from '../../utils/auth'
import { registerSchema } from '../../utils/validation'
import { readZodBody } from '../../utils/body'

function usernameFrom(input: { username?: string; email: string }) {
  return (input.username || input.email.split('@')[0] || 'jogador')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '')
    .slice(0, 32) || `jogador${Date.now()}`
}

export default defineEventHandler(async (event) => {
  const input = await readZodBody(event, registerSchema)
  const username = usernameFrom(input)
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: input.email }, { name: input.name }, { username }] } })

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Ja existe uma conta com este email, nome exibido ou nome de usuario.' })
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      username,
      email: input.email,
      passwordHash: await hashPassword(input.password)
    },
    select: { id: true, name: true, username: true, email: true, avatarUrl: true, profileColor: true }
  })

  await setAuthCookie(event, user.id)
  return { user }
})
