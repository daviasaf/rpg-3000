import { createError, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { jsonValue } from '../../../utils/json'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const messageId = getRouterParam(event, 'messageId') || ''
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } })

  if (!message) throw createError({ statusCode: 404, statusMessage: 'Publicacao nao encontrada.' })
  const metadata = message.metadataJson && typeof message.metadataJson === 'object' && !Array.isArray(message.metadataJson) ? message.metadataJson : {}

  if ((metadata as { sharedByUserId?: unknown }).sharedByUserId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Voce so pode apagar compartilhamentos seus.' })
  }

  const updated = await prisma.chatMessage.update({
    where: { id: message.id },
    data: { metadataJson: jsonValue({ ...metadata, shared: false, unsharedAt: new Date().toISOString() }) }
  })

  return { message: updated }
})

