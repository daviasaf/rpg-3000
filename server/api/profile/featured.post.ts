import { createError } from 'h3'
import { z } from 'zod'
import { readZodBody } from '../../utils/body'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { assertActionCooldown } from '../../utils/rateLimit'

const schema = z.object({
  type: z.enum(['SYSTEM', 'NPC', 'CHARACTER']),
  id: z.string().min(1),
  featured: z.boolean()
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await readZodBody(event, schema)

  assertActionCooldown(`featured:${user.id}:${input.type}:${input.id}`)

  if (input.type === 'SYSTEM') {
    const item = await prisma.system.findUnique({ where: { id: input.id }, select: { id: true, createdById: true, moderationStatus: true } })
    if (!item) throw createError({ statusCode: 404, statusMessage: 'Sistema nao encontrado.' })
    if (item.createdById !== user.id) throw createError({ statusCode: 403, statusMessage: 'Voce so pode destacar conteudos seus.' })
    if (item.moderationStatus !== 'APPROVED') throw createError({ statusCode: 400, statusMessage: 'Apenas sistemas aprovados podem ser destacados.' })
    const system = await prisma.system.update({ where: { id: input.id }, data: { featuredOnProfile: input.featured } })
    return { featured: system.featuredOnProfile }
  }

  if (input.type === 'NPC') {
    const item = await prisma.npc.findUnique({ where: { id: input.id }, select: { id: true, createdById: true, moderationStatus: true } })
    if (!item) throw createError({ statusCode: 404, statusMessage: 'NPC nao encontrado.' })
    if (item.createdById !== user.id) throw createError({ statusCode: 403, statusMessage: 'Voce so pode destacar conteudos seus.' })
    if (item.moderationStatus !== 'APPROVED') throw createError({ statusCode: 400, statusMessage: 'Apenas NPCs aprovados podem ser destacados.' })
    const npc = await prisma.npc.update({ where: { id: input.id }, data: { featuredOnProfile: input.featured } })
    return { featured: npc.featuredOnProfile }
  }

  const item = await prisma.character.findUnique({ where: { id: input.id }, select: { id: true, userId: true, moderationStatus: true } })
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Personagem nao encontrado.' })
  if (item.userId !== user.id) throw createError({ statusCode: 403, statusMessage: 'Voce so pode destacar conteudos seus.' })
  if (item.moderationStatus !== 'APPROVED') throw createError({ statusCode: 400, statusMessage: 'Apenas personagens aprovados podem ser destacados.' })
  const character = await prisma.character.update({ where: { id: input.id }, data: { featuredOnProfile: input.featured } })
  return { featured: character.featuredOnProfile }
})
