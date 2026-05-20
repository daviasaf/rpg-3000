import { createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { hashPassword, setAuthCookie } from '../../utils/auth'
import { registerSchema } from '../../utils/validation'
import { readZodBody } from '../../utils/body'

export default defineEventHandler(async (event) => {
  const input = await readZodBody(event, registerSchema)
  const existing = await prisma.user.findUnique({ where: { email: input.email } })

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Ja existe uma conta com este email.' })
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password)
    },
    select: { id: true, name: true, email: true, avatarUrl: true, profileColor: true }
  })

  await setAuthCookie(event, user.id)
  return { user }
})
