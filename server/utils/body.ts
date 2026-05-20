import { createError, readBody, type H3Event } from 'h3'
import type { z } from 'zod'

const labels: Record<string, string> = {
  name: 'Nome',
  email: 'Email',
  password: 'Senha',
  confirmPassword: 'Confirmar senha',
  description: 'Descricao',
  tags: 'Tags',
  visibility: 'Visibilidade',
  fields: 'Campos da ficha',
  schemaJson: 'Estrutura da ficha',
  systemId: 'Sistema',
  characterId: 'Personagem',
  code: 'Codigo',
  content: 'Mensagem',
  expression: 'Rolagem',
  key: 'Chave',
  label: 'Nome do campo',
  type: 'Tipo do campo',
  category: 'Categoria do campo',
  defaultValue: 'Valor padrao'
}

function friendlyPath(path: Array<string | number>) {
  if (!path.length) return 'Formulario'

  return path
    .map((part, index) => {
      if (typeof part === 'number') return `item ${part + 1}`
      if (part === 'fields' && typeof path[index + 1] === 'number') return 'Campo'
      return labels[part] || part
    })
    .join(' > ')
}

function friendlyMessage(message: string) {
  if (message === 'Required') return 'precisa ser preenchido.'
  if (message.includes('String must contain at least')) return 'esta muito curto.'
  if (message.includes('String must contain at most')) return 'esta muito longo.'
  if (message.includes('Invalid email')) return 'precisa ser um email valido.'
  if (message.includes('Invalid enum value')) return 'tem uma opcao invalida.'
  if (message.includes('Expected array')) return 'precisa ser uma lista.'
  if (message.includes('Expected string')) return 'precisa ser texto.'
  if (message.includes('Expected number')) return 'precisa ser numero.'
  if (message.includes('Expected boolean')) return 'precisa ser verdadeiro ou falso.'
  return message
}

export async function readZodBody<TSchema extends z.ZodTypeAny>(
  event: H3Event,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  const result = schema.safeParse(await readBody(event))

  if (!result.success) {
    const summary = result.error.issues
      .map((issue) => `${friendlyPath(issue.path)}: ${friendlyMessage(issue.message)}`)
      .join(' | ')

    throw createError({
      statusCode: 400,
      statusMessage: summary || 'Dados invalidos.',
      data: { issues: result.error.issues }
    })
  }

  return result.data
}
