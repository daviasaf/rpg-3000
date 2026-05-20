<script setup lang="ts">
import { ArrowLeft, LogIn } from 'lucide-vue-next'

definePageMeta({ pageTransition: { name: 'auth-page', mode: 'out-in' } })

const auth = useAuthStore()
const route = useRoute()
const { apiError } = useToast()
const email = ref('')
const password = ref('')
const loading = ref(false)

onMounted(async () => {
  if (!auth.user) await auth.fetchMe()
  if (auth.user) await navigateTo(typeof route.query.redirect === 'string' ? route.query.redirect : '/app')
})

async function submit() {
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    await navigateTo(typeof route.query.redirect === 'string' ? route.query.redirect : '/app')
  } catch (error) {
    apiError(error, 'Nao foi possivel entrar.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="grid min-h-screen grid-cols-1 lg:grid-cols-2">
    <NuxtLink to="/" class="fixed left-5 top-5 z-10 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-mist hover:text-white">
      <ArrowLeft class="h-4 w-4" />
      Voltar
    </NuxtLink>
    <section class="hidden place-items-center border-r border-white/10 bg-black/20 lg:grid">
      <SigilBlades />
    </section>
    <section class="grid place-items-center px-5 py-10">
      <AuthCard class="auth-panel" title="Entrar" subtitle="Entre para acessar suas fichas e sessoes.">
        <form class="space-y-4" @submit.prevent="submit">
          <label><span class="label">Email</span><input v-model="email" name="email" class="input" type="email" autocomplete="email"></label>
          <label><span class="label">Senha</span><input v-model="password" name="password" class="input" type="password" autocomplete="current-password"></label>
          <AppButton type="submit" class="w-full" :loading="loading"><LogIn class="h-4 w-4" />Entrar</AppButton>
        </form>
        <div class="mt-4 flex flex-wrap justify-between gap-3 text-sm">
          <NuxtLink class="text-mist hover:text-ember" to="/register">Criar conta</NuxtLink>
          <NuxtLink class="text-mist hover:text-ember" to="/forgot-password">Esqueci minha senha</NuxtLink>
        </div>
      </AuthCard>
    </section>
  </div>
</template>
