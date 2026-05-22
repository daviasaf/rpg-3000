import { getRouterParam } from 'h3'
import { requireAdmin } from '../../../../utils/adminAuth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  await prisma.npc.delete({ where: { id } })
  return { ok: true }
})

