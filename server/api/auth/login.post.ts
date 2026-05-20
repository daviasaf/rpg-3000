import { createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { loginSchema } from '../../utils/validation'
import { setAuthCookie, verifyPassword } from '../../utils/auth'
import { readZodBody } from '../../utils/body'

export default defineEventHandler(async (event) => {
  const input = await readZodBody(event, loginSchema)
  const user = await prisma.user.findUnique({ where: { email: input.email } })

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw createError({ statusCode: 401, statusMessage: 'Email ou senha invalidos.' })
  }

  await setAuthCookie(event, user.id)
  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      profileColor: user.profileColor
    }
  }
})
