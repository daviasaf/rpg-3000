<script setup lang="ts">
import { ChevronDown, Image, LogOut, Mail, Palette, Save, Shield, UserRound } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const auth = useAuthStore()
const { push, apiError } = useToast()
const openSection = ref('')
const theme = ref('dark')
const saving = ref('')
const verificationUrl = ref('')
const errors = ref<string[]>([])
const profile = reactive({
  name: '',
  username: '',
  email: '',
  avatarUrl: '',
  profileColor: '#ff8a13',
  currentPassword: '',
  newPassword: ''
})

const sections = [
  { key: 'personal', label: 'Dados pessoais', icon: UserRound },
  { key: 'username', label: 'Trocar nome de usuario', icon: UserRound },
  { key: 'email', label: 'Trocar e-mail', icon: Mail },
  { key: 'password', label: 'Trocar senha', icon: Shield },
  { key: 'avatar', label: 'Foto de perfil', icon: Image },
  { key: 'visual', label: 'Preferencias visuais', icon: Palette }
]

onMounted(() => {
  theme.value = localStorage.getItem('central-rpg:theme') || 'dark'
  syncFromUser()
  if (route.query.verified === '1') {
    push('Alteracao confirmada por email.', 'success')
    void auth.fetchMe().then(syncFromUser)
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

function syncFromUser() {
  profile.name = auth.user?.name || ''
  profile.username = auth.user?.username || auth.user?.email?.split('@')[0] || ''
  profile.email = auth.user?.email || ''
  profile.avatarUrl = auth.user?.avatarUrl || ''
  profile.profileColor = auth.user?.profileColor || localStorage.getItem('central-rpg:accent') || '#ff8a13'
}

function toggle(key: string) {
  openSection.value = openSection.value === key ? '' : key
  errors.value = []
}

function validate(key: string) {
  const next: string[] = []
  if (key === 'personal' && profile.name.trim().length < 2) next.push('Nome exibido precisa ter pelo menos 2 caracteres.')
  if (key === 'username' && !/^[a-zA-Z0-9_.-]{2,32}$/.test(profile.username.trim())) next.push('Nome de usuario deve ter 2 a 32 caracteres.')
  if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) next.push('Informe um email valido.')
  if (key === 'avatar' && profile.avatarUrl && !/^https?:\/\//.test(profile.avatarUrl)) next.push('A foto de perfil precisa ser uma URL valida.')
  if (key === 'password' && profile.newPassword.length < 8) next.push('A nova senha precisa ter pelo menos 8 caracteres.')
  if (key === 'password' && !profile.currentPassword) next.push('Informe a senha atual.')
  errors.value = next
  return next.length === 0
}

function payloadFor(key: string) {
  const payload: Record<string, string> = {}
  if (key === 'personal') payload.name = profile.name
  if (key === 'username') payload.username = profile.username
  if (key === 'email') payload.email = profile.email
  if (key === 'avatar') payload.avatarUrl = profile.avatarUrl
  if (key === 'visual') payload.profileColor = profile.profileColor
  if (key === 'password') {
    payload.currentPassword = profile.currentPassword
    payload.newPassword = profile.newPassword
  }
  return payload
}

async function saveSection(key: string) {
  verificationUrl.value = ''
  if (!validate(key)) {
    push('Corrija os campos antes de salvar.', 'error')
    return
  }

  saving.value = key
  try {
    const response = await $fetch<{ user: NonNullable<typeof auth.user>; pendingVerification?: boolean; verificationUrl?: string }>('/api/auth/profile', {
      method: 'PUT',
      body: payloadFor(key)
    })
    auth.setUser(response.user)
    profile.currentPassword = ''
    profile.newPassword = ''
    verificationUrl.value = response.verificationUrl || ''
    push(response.pendingVerification ? 'Confirme a alteracao pelo e-mail.' : 'Configuracao atualizada.', 'success')
    if (!response.pendingVerification) openSection.value = ''
  } catch (error) {
    apiError(error, 'Nao foi possivel salvar.')
  } finally {
    saving.value = ''
  }
}
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader title="Configuracoes" description="Conta, seguranca e preferencias organizadas por acao." />

    <AppCard>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <AppAvatar :name="auth.user?.name" :src="auth.user?.avatarUrl" :color="auth.user?.profileColor" size="lg" />
          <div>
            <h2 class="text-lg font-black text-white">{{ auth.user?.name }}</h2>
            <p class="text-sm text-mist">{{ auth.user?.username ? `@${auth.user.username}` : 'sem usuario publico' }} · {{ auth.user?.email }}</p>
          </div>
        </div>
        <AppButton variant="danger" @click="auth.logout"><LogOut class="h-4 w-4" />Sair da conta</AppButton>
      </div>
    </AppCard>

    <AppCard v-if="errors.length" class="border-flare/40 bg-flare/10">
      <ul class="space-y-2 text-sm text-red-100">
        <li v-for="error in errors" :key="error">{{ error }}</li>
      </ul>
    </AppCard>

    <div class="space-y-3">
      <AppCard v-for="section in sections" :key="section.key" class="p-0">
        <button type="button" class="flex w-full items-center justify-between gap-3 p-4 text-left" @click="toggle(section.key)">
          <span class="flex items-center gap-3">
            <component :is="section.icon" class="h-5 w-5 text-ember" />
            <span>
              <span class="block font-black text-white">{{ section.label }}</span>
              <span class="text-sm text-mist">Clique para alterar somente esta informacao.</span>
            </span>
          </span>
          <ChevronDown class="h-5 w-5 text-ember transition" :class="openSection === section.key ? 'rotate-180' : ''" />
        </button>

        <form v-if="openSection === section.key" class="border-t border-white/10 p-4" @submit.prevent="saveSection(section.key)">
          <div v-if="section.key === 'personal'" class="grid gap-3">
            <label><span class="label">Nome exibido *</span><input v-model="profile.name" class="input"></label>
          </div>
          <div v-if="section.key === 'username'" class="grid gap-3">
            <label><span class="label">Nome de usuario *</span><input v-model="profile.username" class="input" placeholder="davi.asaf"></label>
          </div>
          <div v-if="section.key === 'email'" class="grid gap-3">
            <label><span class="label">E-mail/Gmail *</span><input v-model="profile.email" class="input" type="email"></label>
            <p class="text-sm text-mist">A troca de e-mail so sera aplicada apos verificacao.</p>
          </div>
          <div v-if="section.key === 'password'" class="grid gap-3 md:grid-cols-2">
            <label><span class="label">Senha atual *</span><input v-model="profile.currentPassword" class="input" type="password" autocomplete="current-password"></label>
            <label><span class="label">Nova senha *</span><input v-model="profile.newPassword" class="input" type="password" autocomplete="new-password"></label>
          </div>
          <div v-if="section.key === 'avatar'" class="grid gap-3 md:grid-cols-[auto_1fr] md:items-end">
            <AppAvatar :name="profile.name" :src="profile.avatarUrl" :color="profile.profileColor" size="xl" />
            <label><span class="label">URL da foto</span><input v-model="profile.avatarUrl" class="input" type="url" placeholder="https://..."></label>
            <AppButton type="button" variant="ghost" @click="profile.avatarUrl = ''">Remover foto</AppButton>
          </div>
          <div v-if="section.key === 'visual'" class="grid gap-3 md:grid-cols-2">
            <label><span class="label">Tema</span><select v-model="theme" class="select"><option value="dark">Dark</option><option value="light">Light</option></select></label>
            <label><span class="label">Cor de destaque</span><input v-model="profile.profileColor" class="input h-10" type="color"></label>
          </div>

          <div class="mt-4 flex justify-end">
            <AppButton type="submit" :loading="saving === section.key"><Save class="h-4 w-4" />Salvar</AppButton>
          </div>
        </form>
      </AppCard>
    </div>

    <AppCard v-if="verificationUrl" class="border-ember/30 bg-ember/10">
      <h2 class="text-lg font-black text-white">Verificacao local</h2>
      <p class="mt-1 text-sm text-mist">Gmail nao configurado ou ambiente local: use este link para confirmar a alteracao.</p>
      <NuxtLink :to="verificationUrl" external class="mt-3 block break-all text-sm font-bold text-ember">{{ verificationUrl }}</NuxtLink>
    </AppCard>
  </div>
</template>
