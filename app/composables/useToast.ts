interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
  actions?: Array<{ label: string; run: () => void | Promise<void> }>
}

const toasts = ref<Toast[]>([])

export function useToast() {
  function push(message: string, type: Toast['type'] = 'info', actions?: Toast['actions']) {
    const toast = { id: Date.now() + Math.random(), type, message, actions }
    toasts.value.push(toast)
    if (!actions?.length) {
      window.setTimeout(() => {
        toasts.value = toasts.value.filter((item) => item.id !== toast.id)
      }, 4200)
    }
  }

  function apiError(error: unknown, fallback = 'Algo saiu do eixo. Tente novamente.') {
    const message = humanizeErrorMessage(extractErrorMessage(error) || fallback)
    push(message, 'error')
    if (import.meta.dev) console.error('[app-error]', error)
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }

  return { toasts, push, apiError, dismiss }
}

export function extractErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return ''

  const candidate = error as {
    message?: unknown
    statusMessage?: unknown
    data?: {
      message?: unknown
      statusMessage?: unknown
      data?: { issues?: Array<{ message?: string; path?: Array<string | number> }> }
      issues?: Array<{ message?: string; path?: Array<string | number> }>
    }
  }

  if (typeof candidate.data?.statusMessage === 'string') return candidate.data.statusMessage
  if (typeof candidate.data?.message === 'string') return candidate.data.message
  if (typeof candidate.statusMessage === 'string') return candidate.statusMessage

  const issues = candidate.data?.data?.issues || candidate.data?.issues
  if (issues?.length) {
    return issues
      .map((issue) => {
        const path = issue.path?.length ? `${issue.path.join('.')}: ` : ''
        return `${path}${issue.message || 'Entrada invalida'}`
      })
      .join(' | ')
  }

  if (typeof candidate.message === 'string' && !candidate.message.includes('[POST]')) {
    return candidate.message
  }

  return ''
}

export function humanizeErrorMessage(message: string) {
  const raw = String(message || '').trim()
  if (!raw) return 'Algo saiu do eixo. Tente novamente.'

  const lower = raw.toLowerCase()
  const looksTechnical = /\[|\]|zod|prisma|stack|trace|expected|required|invalid_type|received|body\.|schema\.|json/i.test(raw)

  if (lower.includes('conteudo ainda esta em analise') || lower.includes('conteúdo ainda está em análise')) {
    return 'Este conteúdo ainda está em análise. Você pode editar ou apagar, mas não pode usar em sessões nem publicar novamente até ser aprovado.'
  }

  if (lower.includes('quantity') || lower.includes('quantidade')) {
    return 'A quantidade do item é obrigatória. Informe pelo menos 1 unidade.'
  }

  if (lower.includes('peso') || lower.includes('capacity') || lower.includes('capacidade')) {
    return 'O personagem ultrapassou o limite de peso permitido pelo sistema. Revise os itens escolhidos.'
  }

  if (lower.includes('classe') && (lower.includes('alteracao') || lower.includes('alteração') || lower.includes('alvo'))) {
    return 'Não foi possível salvar a classe. Verifique se cada alteração tem um alvo válido ou use texto quando for apenas uma observação.'
  }

  if (lower.includes('campo') && (lower.includes('obrigatorio') || lower.includes('obrigatório') || lower.includes('required'))) {
    return 'Existe um campo obrigatório sem preenchimento. Revise os campos marcados com asterisco.'
  }

  if (lower.includes('sistema') && lower.includes('versao')) {
    return 'Esse conteúdo usa uma versão diferente do sistema da sessão. Revise a versão antes de continuar.'
  }

  if (looksTechnical) {
    return 'Não foi possível concluir a ação. Revise os campos obrigatórios e tente novamente.'
  }

  return raw
}
