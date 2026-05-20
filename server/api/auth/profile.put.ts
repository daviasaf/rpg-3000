import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { readZodBody } from '../../utils/body'

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  profileColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await readZodBody(event, profileSchema)

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: input,
    select: { id: true, name: true, email: true, avatarUrl: true, profileColor: true }
  })

  return { user: updated }
})
