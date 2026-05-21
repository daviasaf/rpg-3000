import { createError, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { readZodBody } from '../../../utils/body'
import { prisma } from '../../../utils/prisma'
import { assertActionCooldown } from '../../../utils/rateLimit'

const schema = z.object({ content: z.string().trim().min(1).max(2000) })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const receiverId = getRouterParam(event, 'userId') || ''
  assertActionCooldown(`private-message:${user.id}:${receiverId}`, 700)
  const input = await readZodBody(event, schema)

  const friendship = await prisma.friendRequest.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: user.id, receiverId },
        { senderId: receiverId, receiverId: user.id }
      ]
    }
  })

  if (!friendship) {
    throw createError({ statusCode: 403, statusMessage: 'O chat privado esta disponivel apenas entre amigos.' })
  }

  const message = await prisma.privateMessage.create({
    data: { senderId: user.id, receiverId, content: input.content }
  })

  return { message }
})
