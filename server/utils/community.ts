import type { CommunityContentType, ModerationStatus, Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { jsonValue } from './json'

type SnapshotInput = {
  type: CommunityContentType
  title: string
  description?: string | null
  avatarUrl?: string | null
  tags?: string[]
  status?: ModerationStatus
  authorId?: string | null
  originalSystemId?: string | null
  originalNpcId?: string | null
  originalCharacterId?: string | null
  systemName?: string | null
  snapshotJson: Prisma.InputJsonValue
}

export async function createCommunitySnapshot(input: SnapshotInput) {
  return prisma.communityPost.create({
    data: {
      type: input.type,
      title: input.title,
      description: input.description || null,
      avatarUrl: input.avatarUrl || null,
      tags: input.tags || [],
      status: input.status || 'PENDING',
      authorId: input.authorId || null,
      originalSystemId: input.originalSystemId || null,
      originalNpcId: input.originalNpcId || null,
      originalCharacterId: input.originalCharacterId || null,
      systemName: input.systemName || null,
      snapshotJson: jsonValue(input.snapshotJson)
    }
  })
}

export async function publishSystemSnapshot(systemId: string, authorId: string) {
  const system = await prisma.system.findUnique({
    where: { id: systemId },
    include: { fields: { orderBy: { order: 'asc' } }, createdBy: { select: { id: true } } }
  })

  if (!system || system.createdById !== authorId) return null

  return createCommunitySnapshot({
    type: 'SYSTEM',
    title: system.name,
    description: system.description,
    avatarUrl: system.avatarUrl,
    tags: system.tags,
    status: 'PENDING',
    authorId,
    originalSystemId: system.id,
    systemName: system.name,
    snapshotJson: {
      id: system.id,
      name: system.name,
      description: system.description,
      avatarUrl: system.avatarUrl,
      tags: system.tags,
      visibility: system.visibility,
      schemaJson: system.schemaJson,
      fields: system.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        category: field.category,
        defaultValue: field.defaultValue,
        optionsJson: field.optionsJson,
        formula: field.formula,
        order: field.order
      }))
    }
  })
}

export async function publishNpcSnapshot(npcId: string, authorId: string) {
  const npc = await prisma.npc.findUnique({
    where: { id: npcId },
    include: { system: { select: { id: true, name: true } } }
  })

  if (!npc || npc.createdById !== authorId) return null

  return createCommunitySnapshot({
    type: 'NPC',
    title: npc.name,
    description: npc.description,
    avatarUrl: npc.avatarUrl,
    tags: Array.isArray((npc.dataJson as Record<string, unknown>)?.tags)
      ? ((npc.dataJson as Record<string, unknown>).tags as string[])
      : [],
    status: 'PENDING',
    authorId,
    originalNpcId: npc.id,
    originalSystemId: npc.systemId,
    systemName: npc.system?.name || 'Generico',
    snapshotJson: {
      id: npc.id,
      name: npc.name,
      description: npc.description,
      avatarUrl: npc.avatarUrl,
      systemId: npc.systemId,
      system: npc.system,
      dataJson: npc.dataJson
    }
  })
}

export async function publishCharacterSnapshot(characterId: string, authorId: string) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { system: { include: { fields: { orderBy: { order: 'asc' } } } } }
  })

  if (!character || character.userId !== authorId) return null

  return createCommunitySnapshot({
    type: 'CHARACTER',
    title: character.name,
    description: character.description,
    avatarUrl: character.avatarUrl,
    tags: [character.system.name],
    status: 'PENDING',
    authorId,
    originalCharacterId: character.id,
    originalSystemId: character.systemId,
    systemName: character.system.name,
    snapshotJson: {
      id: character.id,
      name: character.name,
      description: character.description,
      avatarUrl: character.avatarUrl,
      systemId: character.systemId,
      system: {
        id: character.system.id,
        name: character.system.name,
        schemaJson: character.system.schemaJson,
        fields: character.system.fields.map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          category: field.category,
          defaultValue: field.defaultValue,
          optionsJson: field.optionsJson,
          formula: field.formula,
          order: field.order
        }))
      },
      dataJson: character.dataJson
    }
  })
}
