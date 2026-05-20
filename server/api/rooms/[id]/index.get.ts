import { getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { requireRoomAccess } from '../../../utils/permissions'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  await requireRoomAccess(id, user.id)

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      system: { include: { fields: { orderBy: { order: 'asc' } } } },
      master: { select: { id: true, name: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } },
          character: {
            include: {
              system: { include: { fields: { orderBy: { order: 'asc' } } } }
            }
          }
        },
        orderBy: { joinedAt: 'asc' }
      },
      sessions: { orderBy: { startedAt: 'desc' }, take: 1 },
      messages: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } },
          character: { select: { id: true, name: true, avatarUrl: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 80
      }
    }
  })

  const safeRoom = room
    ? {
        ...room,
        members: room.members.map((member) => {
          const canSeeSheet = room.masterId === user.id || member.userId === user.id

          if (!member.character || canSeeSheet) {
            return member
          }

          return {
            ...member,
            character: {
              id: member.character.id,
              name: member.character.name,
              avatarUrl: member.character.avatarUrl,
              dataJson: null
            }
          }
        })
      }
    : room

  return { room: safeRoom }
})
