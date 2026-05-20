import { createError, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { readZodBody } from '../../../utils/body'
import { requireRoomAccess } from '../../../utils/permissions'
import { prisma } from '../../../utils/prisma'

const schema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(20)
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'id') || ''
  const input = await readZodBody(event, schema)
  const room = await requireRoomAccess(roomId, user.id)
  const targetIds = [...new Set(input.userIds.filter((id) => id !== user.id))]

  if (targetIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Selecione pelo menos um amigo.' })
  }

  const friendships = await prisma.friendRequest.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: user.id, receiverId: { in: targetIds } },
        { senderId: { in: targetIds }, receiverId: user.id }
      ]
    }
  })
  const allowedIds = new Set(friendships.map((item) => item.senderId === user.id ? item.receiverId : item.senderId))
  const validTargetIds = targetIds.filter((id) => allowedIds.has(id))

  if (validTargetIds.length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'Convites so podem ser enviados para amigos.' })
  }

  const existingMembers = await prisma.roomMember.findMany({
    where: { roomId, userId: { in: validTargetIds } },
    select: { userId: true }
  })
  const memberIds = new Set(existingMembers.map((item) => item.userId))
  const finalTargets = validTargetIds.filter((id) => !memberIds.has(id))

  if (finalTargets.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Os amigos selecionados ja estao na sessao.' })
  }

  const marker = `[convite:${room.id}]`
  const recentInvites = await prisma.privateMessage.findMany({
    where: {
      senderId: user.id,
      receiverId: { in: finalTargets },
      content: { contains: marker }
    },
    select: { receiverId: true }
  })
  const recentlyInvited = new Set(recentInvites.map((item) => item.receiverId))
  const recipients = finalTargets.filter((id) => !recentlyInvited.has(id))

  if (recipients.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Convite ja enviado para estes amigos nesta sessao.' })
  }

  await prisma.privateMessage.createMany({
    data: recipients.map((receiverId) => ({
      senderId: user.id,
      receiverId,
      content: `${marker} ${user.name} convidou voce para entrar na sessao "${room.name}". Acesse: /app/rooms/join?code=${room.code}`
    }))
  })

  return { invited: recipients.length }
})
