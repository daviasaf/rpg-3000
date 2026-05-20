<script setup lang="ts">
import { LogOut, Save, Shield, UserRound } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const auth = useAuthStore()
const { push, apiError } = useToast()
const theme = ref('dark')
const profile = reactive({
  name: '',
  username: '',
  email: '',
  avatarUrl: '',
  profileColor: '#ff8a13',
  currentPassword: '',
  newPassword: ''
})
const saving = ref(false)
const verificationUrl = ref('')
const errors = ref<string[]>([])

onMounted(() => {
  theme.value = localStorage.getItem('central-rpg:theme') || 'dark'
  profile.name = auth.user?.name || ''
  profile.username = auth.user?.username || auth.user?.email?.split('@')[0] || ''
  profile.email = auth.user?.email || ''
  profile.avatarUrl = auth.user?.avatarUrl || ''
  profile.profileColor = auth.user?.profileColor || localStorage.getItem('central-rpg:accent') || '#ff8a13'
  document.documentElement.style.setProperty('--user-accent', profile.profileColor)
  if (route.query.verified === '1') {
    push('Alteracao confirmada por email.', 'success')
    void auth.fetchMe()
  }
})

watch(theme, (next) => {
  if (!import.meta.client) return
  localStorage.setItem('central-rpg:theme', next)
  document.documentElement.classList.toggle('light-theme', next === 'light')
})

watch(() => profile.profileColor, (next) => {
  if (!import.meta.client) return
  localStorage.setItem('central-rpg:accent', next)
  document.documentElement.style.setProperty('--user-accent', next)
})

function validate() {
  const next: string[] = []
  if (profile.name.trim().length < 2) next.push('Nome exibido precisa ter pelo menos 2 caracteres.')
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(profile.username.trim())) next.push('Nome de usuario deve ter 2 a 32 caracteres e usar apenas letras, numeros, ponto, hifen ou underline.')
  if (!profile.email.includes('@')) next.push('Informe um email valido.')
  if (profile.avatarUrl && !profile.avatarUrl.startsWith('http')) next.push('A foto de perfil precisa ser uma URL valida.')
  if (profile.newPassword && profile.newPassword.length < 8) next.push('A nova senha precisa ter pelo menos 8 caracteres.')
  if (profile.newPassword && !profile.currentPassword) next.push('Informe a senha atual para trocar a senha.')
  errors.value = next
  return next.length === 0
}

async function saveProfile() {
  verificationUrl.value = ''
  if (!validate()) {
    push('Corrija os campos antes de salvar.', 'error')
    return
  }

  saving.value = true
  try {
    const response = await $fetch<{ user: NonNullable<typeof auth.user>; pendingVerification?: boolean; verificationUrl?: string }>('/api/auth/profile', {
      method: 'PUT',
      body: {
        name: profile.name,
        username: profile.username,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        profileColor: profile.profileColor,
        currentPassword: profile.currentPassword || undefined,
        newPassword: profile.newPassword || undefined
      }
    })
    auth.setUser(response.user)
    profile.currentPassword = ''
    profile.newPassword = ''
    verificationUrl.value = response.verificationUrl || ''
    push(response.pendingVerification ? 'Enviamos um email para confirmar as alteracoes sensiveis.' : 'Perfil atualizado.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel salvar o perfil.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader title="Configuracoes" description="Perfil, seguranca e preferencias da sua conta." />

    <AppCard>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <AppAvatar :name="auth.user?.name" :src="auth.user?.avatarUrl" :color="auth.user?.profileColor" size="lg" />
          <div>
            <h2 class="text-lg font-black text-white">{{ auth.user?.name }}</h2>
            <p class="text-sm text-mist">@{{ auth.user?.username }} · {{ auth.user?.email }}</p>
          </div>
        </div>
        <AppButton variant="danger" @click="auth.logout">
          <LogOut class="h-4 w-4" />
          Sair da conta
        </AppButton>
      </div>
    </AppCard>

    <AppCard v-if="errors.length" class="border-flare/40 bg-flare/10">
      <h2 class="text-lg font-black text-white">Antes de salvar:</h2>
      <ul class="mt-3 space-y-2 text-sm text-red-100">
        <li v-for="error in errors" :key="error">{{ error }}</li>
      </ul>
    </AppCard>

    <AppCard>
      <h2 class="text-lg font-black text-white">Perfil</h2>
      <p class="mt-1 text-sm text-mist">Nome exibido, nome de usuario e email sao unicos. Alteracoes sensiveis precisam de confirmacao por email.</p>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <label>
          <span class="label">Nome exibido *</span>
          <input v-model="profile.name" class="input" type="text">
        </label>
        <label>
          <span class="label">Nome de usuario *</span>
          <input v-model="profile.username" class="input" type="text" placeholder="davi.asaf">
        </label>
        <label>
          <span class="label">E-mail/Gmail *</span>
          <input v-model="profile.email" class="input" type="email">
        </label>
        <label>
          <span class="label">Foto de perfil</span>
          <input v-model="profile.avatarUrl" class="input" type="url" placeholder="https://...">
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
          <input v-model="profile.profileColor" class="input h-10" type="color">
        </label>
      </div>
    </AppCard>

    <AppCard>
      <div class="flex items-start gap-3">
        <Shield class="mt-1 h-5 w-5 text-ember" />
        <div class="flex-1">
          <h2 class="text-lg font-black text-white">Seguranca</h2>
          <p class="mt-1 text-sm text-mist">Para trocar a senha, confirme a senha atual. A alteracao so e aplicada depois da verificacao por email.</p>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <label>
              <span class="label">Senha atual</span>
              <input v-model="profile.currentPassword" class="input" type="password" autocomplete="current-password">
            </label>
            <label>
              <span class="label">Nova senha</span>
              <input v-model="profile.newPassword" class="input" type="password" autocomplete="new-password">
            </label>
          </div>
        </div>
      </div>
    </AppCard>

    <AppCard v-if="verificationUrl" class="border-ember/30 bg-ember/10">
      <h2 class="text-lg font-black text-white">Ambiente local</h2>
      <p class="mt-1 text-sm text-mist">Gmail nao configurado ou ambiente local: use este link para confirmar a alteracao.</p>
      <NuxtLink :to="verificationUrl" external class="mt-3 block break-all text-sm font-bold text-ember">{{ verificationUrl }}</NuxtLink>
    </AppCard>

    <AppButton :loading="saving" @click="saveProfile">
      <Save class="h-4 w-4" />
      Salvar configuracoes
    </AppButton>
  </div>
</template>
