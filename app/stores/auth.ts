import { defineStore } from 'pinia'

interface AuthUser {
  id: string
  name: string
  username: string | null
  email: string
  avatarUrl: string | null
  profileColor: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)

  async function fetchMe() {
    loading.value = true
    try {
      const response = await $fetch<{ user: AuthUser | null }>('/api/auth/me', {
        headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
      })
      user.value = response.user
      return user.value
    } catch {
      user.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  function setUser(next: AuthUser) {
    user.value = next
  }

  async function login(email: string, password: string) {
    const response = await $fetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    user.value = response.user
  }

  async function register(payload: { name: string; username?: string; email: string; password: string; confirmPassword: string }) {
    const response = await $fetch<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: payload
    })
    user.value = response.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/login')
  }

  return { user, loading, fetchMe, login, register, logout, setUser }
})

