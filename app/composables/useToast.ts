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
    const message = extractErrorMessage(error) || fallback
    push(message, 'error')
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
