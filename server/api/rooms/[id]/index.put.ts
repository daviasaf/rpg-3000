import { getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { requireRoomMaster } from '../../../utils/permissions'
import { prisma } from '../../../utils/prisma'
import { updateRoomSchema } from '../../../utils/validation'
import { readZodBody } from '../../../utils/body'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  await requireRoomMaster(id, user.id)
  const input = await readZodBody(event, updateRoomSchema)

  const room = await prisma.room.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      systemId: input.systemId,
      isPublic: input.isPublic
    },
    include: { system: true, members: { include: { character: true } } }
  })

  return { room }
})
