import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'
import { assertActionCooldown } from '../../../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const profileId = getRouterParam(event, 'id') || ''

  assertActionCooldown(`profile-like:${user.id}:${profileId}`)

  if (!profileId) {
    throw createError({ statusCode: 400, statusMessage: 'Perfil invalido.' })
  }

  if (profileId === user.id) {
    throw createError({ statusCode: 400, statusMessage: 'Voce nao pode curtir o proprio perfil.' })
  }

  const profile = await prisma.user.findUnique({ where: { id: profileId }, select: { id: true } })
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Perfil nao encontrado.' })
  }

  const existing = await prisma.userProfileLike.findUnique({
    where: { profileId_userId: { profileId, userId: user.id } }
  })

  if (existing) {
    await prisma.userProfileLike.delete({ where: { id: existing.id } })
    const count = await prisma.userProfileLike.count({ where: { profileId } })
    return { liked: false, count }
  }

  await prisma.userProfileLike.create({ data: { profileId, userId: user.id } })
  const count = await prisma.userProfileLike.count({ where: { profileId } })
  return { liked: true, count }
})
