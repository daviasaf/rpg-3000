import { createError, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { readZodBody } from '../../../utils/body'

const schema = z.object({ content: z.string().trim().min(1).max(500) })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const systemId = getRouterParam(event, 'id') || ''
  const input = await readZodBody(event, schema)
  const system = await prisma.system.findUnique({ where: { id: systemId } })

  if (!system) throw createError({ statusCode: 404, statusMessage: 'Sistema nao encontrado.' })

  const comment = await prisma.systemComment.create({
    data: { systemId, userId: user.id, content: input.content },
    include: { user: { select: { id: true, name: true, avatarUrl: true, profileColor: true } } }
  })

  return { comment }
})

