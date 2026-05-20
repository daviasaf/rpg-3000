export default defineNuxtPlugin(() => {
  const { apiError } = useToast()

  window.addEventListener('unhandledrejection', (event) => {
    apiError(event.reason, 'Erro inesperado na aplicacao.')
  })

  window.addEventListener('error', (event) => {
    if (event.message?.includes('ResizeObserver')) return
    apiError(event.error || event.message, 'Erro inesperado na interface.')
  })
})
