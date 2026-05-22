import { createError, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { readZodBody } from '../../../utils/body'
import { prisma } from '../../../utils/prisma'

const schema = z.object({ status: z.enum(['ACCEPTED', 'REJECTED']) })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const input = await readZodBody(event, schema)
  const request = await prisma.friendRequest.findUnique({ where: { id } })

  if (!request || request.receiverId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Solicitacao nao encontrada.' })
  }

  const updated = await prisma.friendRequest.update({
    where: { id },
    data: { status: input.status }
  })

  return { request: updated }
})

