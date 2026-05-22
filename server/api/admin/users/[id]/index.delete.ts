import { createError, getRouterParam } from 'h3'
import { requireAdmin } from '../../../../utils/adminAuth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true }
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Usuario nao encontrado.' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.privateMessage.deleteMany({
      where: {
        OR: [
          { senderId: id },
          { receiverId: id }
        ]
      }
    })

    await tx.user.delete({ where: { id } })
  })

  return { ok: true, deletedUser: { id: user.id, name: user.name } }
})

