import { createError } from 'h3'
import { requireAuth } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)

  throw createError({
    statusCode: 410,
    statusMessage: 'Perfis exibem informacoes, criacoes e comentarios recebidos. Postagens no proprio perfil foram removidas.'
  })
})

