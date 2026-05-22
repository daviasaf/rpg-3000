<script setup lang="ts">
import { ArrowLeft, Mail } from 'lucide-vue-next'

definePageMeta({ pageTransition: { name: 'auth-page', mode: 'out-in' } })

const { push, apiError } = useToast()
const email = ref('')
const resetUrl = ref('')
const loading = ref(false)

async function submit() {
  loading.value = true
  try {
    const response = await $fetch<{ resetUrl?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.value }
    })
    resetUrl.value = response.resetUrl || ''
    push('Fluxo de recuperacao iniciado.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel solicitar recuperacao.')
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
    <AuthCard class="auth-panel" title="Recuperar senha" subtitle="Informe seu email para receber o link de redefinicao.">
      <form class="space-y-4" @submit.prevent="submit">
        <label><span class="label">Email</span><input v-model="email" name="email" class="input" type="email" autocomplete="email"></label>
        <AppButton type="submit" class="w-full" :loading="loading"><Mail class="h-4 w-4" />Enviar link</AppButton>
      </form>
      <div v-if="resetUrl" class="mt-4 rounded-lg border border-ember/30 bg-ember/10 p-3 text-sm text-ember">
        Desenvolvimento sem SMTP: <NuxtLink class="underline" :to="resetUrl.replace(/^https?:\/\/[^/]+/, '')">abrir reset</NuxtLink>
      </div>
      <NuxtLink class="mt-4 inline-block text-sm text-mist hover:text-ember" to="/login">Voltar para login</NuxtLink>
    </AuthCard>
  </div>
</template>

