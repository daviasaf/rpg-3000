import { createError, getRouterParam, readBody } from 'h3'
import { requireAdmin } from '../../../../utils/adminAuth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await readBody<{ status?: 'PENDING' | 'APPROVED' | 'REJECTED'; reason?: string }>(event)
  const status = body?.status
  if (!status || !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'Status invalido.' })
  }

  const system = await prisma.system.update({
    where: { id },
    data: { moderationStatus: status, moderationReason: status === 'REJECTED' ? body.reason || null : null }
  })

  return { system }
})

