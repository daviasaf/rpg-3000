import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { updateCharacterSchema } from '../../../utils/validation'
import { jsonValue } from '../../../utils/json'
import { readZodBody } from '../../../utils/body'
import { validateCharacterData } from '~~/shared/utils/characterRules'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const input = await readZodBody(event, updateCharacterSchema)
  const character = await prisma.character.findUnique({
    where: { id },
    include: { system: { include: { fields: true } } }
  })

  if (!character) {
    throw createError({ statusCode: 404, statusMessage: 'Personagem nao encontrado.' })
  }

  if (character.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Voce nao pode editar esta ficha.' })
  }

  if (character.moderationStatus === 'REJECTED') {
    throw createError({ statusCode: 403, statusMessage: 'Personagem rejeitado nao pode ser editado. Crie uma nova versao para enviar novamente.' })
  }

  const dataJson = input.dataJson ? { ...(character.dataJson as Record<string, unknown>), ...input.dataJson } : undefined
  if (dataJson) {
    const ruleErrors = validateCharacterData(character.system.schemaJson as any, character.system.fields as any, dataJson)
    if (ruleErrors.length) {
      throw createError({ statusCode: 400, statusMessage: ruleErrors[0], data: { errors: ruleErrors } })
    }
  }

  const hasApprovedCommunityPost = await prisma.communityPost.count({ where: { originalCharacterId: id, status: 'APPROVED' } })

  const updated = await prisma.$transaction(async (tx) => {
    if (dataJson) {
      await tx.characterFieldValue.deleteMany({ where: { characterId: id } })
    }

    return tx.character.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        avatarUrl: input.avatarUrl === '' ? null : input.avatarUrl,
        systemId: input.systemId,
        moderationStatus: hasApprovedCommunityPost ? 'PENDING' : undefined,
        moderationReason: hasApprovedCommunityPost ? null : undefined,
        featuredOnProfile: hasApprovedCommunityPost ? false : undefined,
        dataJson: dataJson ? jsonValue(dataJson) : undefined,
        values: dataJson
          ? {
              create: Object.entries(dataJson).map(([key, value]) => ({
                key,
                valueJson: jsonValue(value),
                fieldId: character.system.fields.find((field) => field.key === key)?.id
              }))
            }
          : undefined
      },
      include: { system: { include: { fields: { orderBy: { order: 'asc' } } } }, values: true }
    })
  })

  return { character: updated }
})

