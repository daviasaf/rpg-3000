import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { jsonValue } from '../../utils/json'
import { readZodBody } from '../../utils/body'
import { publishNpcSnapshot } from '../../utils/community'

const npcSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  avatarUrl: z.string().trim().url().optional().or(z.literal('')).nullable(),
  systemId: z.string().optional().nullable(),
  isCommunity: z.boolean().default(false),
  dataJson: z.record(z.unknown()).default({})
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await readZodBody(event, npcSchema)

  const npc = await prisma.npc.create({
    data: {
      name: input.name,
      description: input.description,
      avatarUrl: input.avatarUrl || null,
      systemId: input.systemId || null,
      isCommunity: input.isCommunity,
      moderationStatus: input.isCommunity ? 'PENDING' : 'APPROVED',
      createdById: user.id,
      dataJson: jsonValue(input.dataJson)
    },
    include: {
      system: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { likes: true, comments: true } }
    }
  })

  if (input.isCommunity) {
    await publishNpcSnapshot(npc.id, user.id)
  }

  return { npc }
})

