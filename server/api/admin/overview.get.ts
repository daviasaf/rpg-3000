import { requireAdmin } from '../../utils/adminAuth'
import { prisma } from '../../utils/prisma'

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function buildSeries(items: Array<{ createdAt: Date }>, days = 14) {
  const today = startOfDay(new Date())
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days - 1 - index))
    return { key: dayKey(date), label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: 0 }
  })
  const byKey = new Map(buckets.map((item) => [item.key, item]))

  for (const item of items) {
    const bucket = byKey.get(dayKey(startOfDay(item.createdAt)))
    if (bucket) bucket.value += 1
  }

  return buckets
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const since = new Date()
  since.setDate(since.getDate() - 13)
  const sinceStart = startOfDay(since)

  const [
    users,
    systems,
    npcs,
    characters,
    rooms,
    communityPosts,
    messages,
    moderationCounts,
    recentUsers,
    recentPosts
  ] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: sinceStart } }, select: { createdAt: true } }),
    prisma.system.findMany({ where: { createdAt: { gte: sinceStart } }, select: { createdAt: true } }),
    prisma.npc.findMany({ where: { createdAt: { gte: sinceStart } }, select: { createdAt: true } }),
    prisma.character.findMany({ where: { createdAt: { gte: sinceStart } }, select: { createdAt: true } }),
    prisma.room.findMany({ where: { createdAt: { gte: sinceStart } }, select: { createdAt: true } }),
    prisma.communityPost.findMany({ where: { createdAt: { gte: sinceStart } }, select: { createdAt: true, type: true, status: true } }),
    prisma.chatMessage.findMany({ where: { createdAt: { gte: sinceStart } }, select: { createdAt: true } }),
    prisma.communityPost.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, name: true, username: true, email: true, avatarUrl: true, profileColor: true, createdAt: true }
    }),
    prisma.communityPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { author: { select: { id: true, name: true, username: true, avatarUrl: true, profileColor: true } } }
    })
  ])

  const totals = await prisma.$transaction([
    prisma.user.count(),
    prisma.system.count(),
    prisma.npc.count(),
    prisma.character.count(),
    prisma.room.count(),
    prisma.communityPost.count(),
    prisma.chatMessage.count()
  ])

  const postsByType = communityPosts.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1
    return acc
  }, {})

  return {
    totals: {
      users: totals[0],
      systems: totals[1],
      npcs: totals[2],
      characters: totals[3],
      rooms: totals[4],
      communityPosts: totals[5],
      messages: totals[6]
    },
    moderation: {
      pending: moderationCounts.find((item) => item.status === 'PENDING')?._count._all || 0,
      approved: moderationCounts.find((item) => item.status === 'APPROVED')?._count._all || 0,
      rejected: moderationCounts.find((item) => item.status === 'REJECTED')?._count._all || 0
    },
    series: {
      users: buildSeries(users),
      systems: buildSeries(systems),
      npcs: buildSeries(npcs),
      characters: buildSeries(characters),
      rooms: buildSeries(rooms),
      communityPosts: buildSeries(communityPosts),
      messages: buildSeries(messages)
    },
    postsByType: {
      systems: postsByType.SYSTEM || 0,
      npcs: postsByType.NPC || 0,
      characters: postsByType.CHARACTER || 0
    },
    recentUsers,
    recentPosts
  }
})
