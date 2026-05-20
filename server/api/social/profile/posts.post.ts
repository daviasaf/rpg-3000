import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { readZodBody } from '../../../utils/body'
import { prisma } from '../../../utils/prisma'

const schema = z.object({ content: z.string().trim().min(1).max(1200) })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await readZodBody(event, schema)
  const post = await prisma.profilePost.create({
    data: { userId: user.id, content: input.content, isPublic: true }
  })

  return { post }
})
