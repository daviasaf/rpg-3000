<script setup lang="ts">
import { LogOut, Shield, UserRound } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const auth = useAuthStore()
const { push, apiError } = useToast()
const theme = ref('dark')
const displayName = ref('')
const accent = ref('#ff8a13')
const saving = ref(false)

onMounted(() => {
  theme.value = localStorage.getItem('central-rpg:theme') || 'dark'
  displayName.value = auth.user?.name || ''
  accent.value = auth.user?.profileColor || localStorage.getItem('central-rpg:accent') || '#ff8a13'
  document.documentElement.style.setProperty('--user-accent', accent.value)
})

watch(theme, (next) => {
  if (!import.meta.client) return
  localStorage.setItem('central-rpg:theme', next)
  document.documentElement.classList.toggle('light-theme', next === 'light')
})

watch(accent, (next) => {
  if (!import.meta.client) return
  localStorage.setItem('central-rpg:accent', next)
  document.documentElement.style.setProperty('--user-accent', next)
})

async function saveProfile() {
  saving.value = true
  try {
    const response = await $fetch<{ user: NonNullable<typeof auth.user> }>('/api/auth/profile', {
      method: 'PUT',
      body: { name: displayName.value, profileColor: accent.value }
    })
    auth.setUser(response.user)
    localStorage.setItem('central-rpg:accent', response.user.profileColor)
    document.documentElement.style.setProperty('--user-accent', response.user.profileColor)
    push('Perfil atualizado.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel salvar o perfil.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="page-title">Configuracoes</h1>
      <p class="mt-2 text-mist">Perfil, seguranca e preferencias da sua conta.</p>
    </div>

    <AppCard>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-ember">
            <UserRound class="h-5 w-5" />
          </div>
          <div>
            <h2 class="text-lg font-black text-white">{{ auth.user?.name }}</h2>
            <p class="text-sm text-mist">{{ auth.user?.email }}</p>
          </div>
        </div>
        <AppButton variant="danger" @click="auth.logout">
          <LogOut class="h-4 w-4" />
          Sair da conta
        </AppButton>
      </div>
    </AppCard>

    <AppCard>
      <h2 class="text-lg font-black text-white">Personalizacao</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-3">
        <label>
          <span class="label">Nome exibido</span>
          <input v-model="displayName" class="input" type="text">
        </label>
        <label>
          <span class="label">Tema</span>
          <select v-model="theme" class="select">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label>
          <span class="label">Cor de destaque</span>
          <input v-model="accent" class="input h-[42px]" type="color">
        </label>
      </div>
      <AppButton class="mt-4" :loading="saving" @click="saveProfile">Salvar perfil</AppButton>
    </AppCard>

    <AppCard>
      <div class="flex items-start gap-3">
        <Shield class="mt-1 h-5 w-5 text-ember" />
        <div>
          <h2 class="text-lg font-black text-white">Seguranca</h2>
          <p class="mt-1 text-sm text-mist">Sua sessao usa cookie HTTP-only. A recuperacao de senha usa token temporario e envio por Gmail quando configurado.</p>
        </div>
      </div>
    </AppCard>
  </div>
</template>
