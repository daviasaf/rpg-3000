import { getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../../../utils/auth'
import { readZodBody } from '../../../../../utils/body'
import { prisma } from '../../../../../utils/prisma'

const schema = z.object({ content: z.string().trim().min(1).max(800) })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const postId = getRouterParam(event, 'id') || ''
  const input = await readZodBody(event, schema)
  const comment = await prisma.profileComment.create({
    data: { postId, userId: user.id, content: input.content }
  })

  return { comment }
})
