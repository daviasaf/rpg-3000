<script setup lang="ts">
import { ArrowLeft, KeyRound } from 'lucide-vue-next'

definePageMeta({ pageTransition: { name: 'auth-page', mode: 'out-in' } })

const route = useRoute()
const { push, apiError } = useToast()
const form = reactive({
  token: String(route.query.token || ''),
  password: '',
  confirmPassword: ''
})
const loading = ref(false)

async function submit() {
  loading.value = true
  try {
    await $fetch('/api/auth/reset-password', { method: 'POST', body: form })
    push('Senha redefinida. Entre novamente.', 'success')
    await navigateTo('/login')
  } catch (error) {
    apiError(error, 'Nao foi possivel redefinir senha.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="grid min-h-screen place-items-center px-5 py-10">
    <NuxtLink to="/login" class="fixed left-5 top-5 z-10 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-mist hover:text-white">
      <ArrowLeft class="h-4 w-4" />
      Voltar
    </NuxtLink>
    <AuthCard class="auth-panel" title="Nova senha" subtitle="Crie uma senha forte para recuperar o acesso.">
      <form class="space-y-4" @submit.prevent="submit">
        <label><span class="label">Token</span><input v-model="form.token" name="token" class="input" type="text"></label>
        <label><span class="label">Nova senha</span><input v-model="form.password" name="password" class="input" type="password" autocomplete="new-password"></label>
        <label><span class="label">Confirmar senha</span><input v-model="form.confirmPassword" name="confirmPassword" class="input" type="password" autocomplete="new-password"></label>
        <AppButton type="submit" class="w-full" :loading="loading"><KeyRound class="h-4 w-4" />Redefinir</AppButton>
      </form>
    </AuthCard>
  </div>
</template>

