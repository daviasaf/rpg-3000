import { createError } from 'h3'
import { prisma } from './prisma'

export async function requireRoomAccess(roomId: string, userId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      members: {
        where: { userId },
        include: { character: true }
      }
    }
  })

  if (!room) {
    throw createError({ statusCode: 404, statusMessage: 'Sala nao encontrada.' })
  }

  if (room.masterId !== userId && room.members.length === 0 && !room.isPublic) {
    throw createError({ statusCode: 403, statusMessage: 'Voce nao tem acesso a esta sala.' })
  }

  return room
}

export async function requireRoomMaster(roomId: string, userId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room) {
    throw createError({ statusCode: 404, statusMessage: 'Sala nao encontrada.' })
  }

  if (room.masterId !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Apenas o mestre pode fazer isso.' })
  }

  return room
}

