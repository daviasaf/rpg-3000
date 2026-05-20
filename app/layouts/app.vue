<script setup lang="ts">
onMounted(async () => {
  const auth = useAuthStore()
  const theme = localStorage.getItem('central-rpg:theme') || 'dark'
  const localAccent = localStorage.getItem('central-rpg:accent')
  const accent = localAccent || auth.user?.profileColor || '#ff8a13'
  document.documentElement.classList.toggle('light-theme', theme === 'light')
  document.documentElement.style.setProperty('--user-accent', accent)
  if (auth.user && localAccent && localAccent !== auth.user.profileColor) {
    try {
      const response = await $fetch<{ user: NonNullable<typeof auth.user> }>('/api/auth/profile', {
        method: 'PUT',
        body: { profileColor: localAccent }
      })
      auth.setUser(response.user)
    } catch {
      // Visual preference sync is best-effort; the app can continue with the local color.
    }
  }
})
</script>

<template>
  <div class="min-h-screen bg-void/70">
    <AppSidebar />
    <div class="app-shell-content min-h-screen">
      <AppHeader />
      <main class="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <slot />
      </main>
    </div>
    <ToastStack />
  </div>
</template>
