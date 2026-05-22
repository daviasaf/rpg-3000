import { getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { requireRoomMaster } from '../../../utils/permissions'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  await requireRoomMaster(id, user.id)
  await prisma.room.delete({ where: { id } })
  return { ok: true }
})

