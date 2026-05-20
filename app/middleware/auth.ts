export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (!auth.user) {
    await auth.fetchMe()
  }
  if (!auth.user) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } }, { replace: true })
  }
})
