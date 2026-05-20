<script setup lang="ts">
import { LogIn } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { push, apiError } = useToast()
const { data: characters } = await useFetch<{ characters: Array<{ id: string; name: string; system?: { name: string } }> }>('/api/characters')
const form = reactive({ code: '', characterId: '' })
const loading = ref(false)
const hasCharacters = computed(() => Boolean(characters.value?.characters.length))

async function submit() {
  loading.value = true
  try {
    const response = await $fetch<{ roomId: string }>('/api/rooms/join', { method: 'POST', body: form })
    push('Voce entrou na sala.', 'success')
    await navigateTo(`/app/rooms/${response.roomId}`)
  } catch (error) {
    apiError(error, 'Nao foi possivel entrar na sala.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-5">
    <div>
      <h1 class="page-title">Entrar por codigo</h1>
      <p class="muted mt-1">Informe o codigo da sala e escolha uma ficha compativel.</p>
    </div>
    <AppCard>
      <form class="space-y-4" @submit.prevent="submit">
        <label><span class="label">Codigo *</span><input v-model="form.code" name="code" class="input uppercase" type="text" placeholder="A7K9Q2"></label>
        <label><span class="label">Personagem *</span><select v-model="form.characterId" class="select" :disabled="!hasCharacters"><option value="">{{ hasCharacters ? 'Escolha uma ficha' : 'Nenhum personagem disponível' }}</option><option v-for="character in characters?.characters" :key="character.id" :value="character.id">{{ character.name }} - {{ character.system?.name }}</option></select></label>
        <p v-if="!hasCharacters" class="rounded-lg border border-ember/25 bg-ember/10 p-3 text-sm text-ember">Crie um personagem antes de entrar em uma sala.</p>
        <AppButton type="submit" :loading="loading" :disabled="!hasCharacters"><LogIn class="h-4 w-4" />Entrar</AppButton>
      </form>
    </AppCard>
  </div>
</template>
