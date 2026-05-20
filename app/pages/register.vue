<script setup lang="ts">
import { ArrowLeft, UserPlus } from 'lucide-vue-next'

definePageMeta({ pageTransition: { name: 'auth-page', mode: 'out-in' } })

const auth = useAuthStore()
const { apiError } = useToast()
const form = reactive({ name: '', email: '', password: '', confirmPassword: '' })
const loading = ref(false)

async function submit() {
  loading.value = true
  try {
    await auth.register(form)
    await navigateTo('/app')
  } catch (error) {
    apiError(error, 'Nao foi possivel cadastrar.')
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
    <section class="grid place-items-center px-5 py-10">
      <AuthCard class="auth-panel" title="Criar conta" subtitle="Monte suas campanhas e entre nas mesas.">
        <form class="space-y-4" @submit.prevent="submit">
          <label><span class="label">Nome</span><input v-model="form.name" name="name" class="input" type="text" autocomplete="name"></label>
          <label><span class="label">Email</span><input v-model="form.email" name="email" class="input" type="email" autocomplete="email"></label>
          <label><span class="label">Senha</span><input v-model="form.password" name="password" class="input" type="password" autocomplete="new-password"></label>
          <label><span class="label">Confirmar senha</span><input v-model="form.confirmPassword" name="confirmPassword" class="input" type="password" autocomplete="new-password"></label>
          <AppButton type="submit" class="w-full" :loading="loading"><UserPlus class="h-4 w-4" />Cadastrar</AppButton>
        </form>
        <p class="mt-4 text-sm text-mist">Ja tem conta? <NuxtLink class="font-bold text-ember" to="/login">Entrar</NuxtLink></p>
      </AuthCard>
    </section>
    <section class="hidden place-items-center border-l border-white/10 bg-black/20 lg:grid">
      <SigilBlades />
    </section>
  </div>
</template>
