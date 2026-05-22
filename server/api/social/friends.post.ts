import { createError } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { readZodBody } from '../../utils/body'
import { prisma } from '../../utils/prisma'

const schema = z.object({ userId: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await readZodBody(event, schema)
  if (input.userId === user.id) {
    throw createError({ statusCode: 400, statusMessage: 'Voce nao pode adicionar a si mesmo.' })
  }

  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: user.id, receiverId: input.userId },
        { senderId: input.userId, receiverId: user.id }
      ]
    }
  })

  if (existing) return { request: existing }

  const request = await prisma.friendRequest.create({
    data: { senderId: user.id, receiverId: input.userId }
  })

  return { request }
})

