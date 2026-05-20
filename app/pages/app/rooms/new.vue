<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

const { push, apiError } = useToast()
const { data: systems } = await useFetch<{ systems: Array<{ id: string; name: string }> }>('/api/systems')
const { data: characters } = await useFetch<{ characters: Array<{ id: string; name: string; systemId: string }> }>('/api/characters')
const form = reactive({
  name: '',
  description: '',
  systemId: systems.value?.systems[0]?.id || '',
  characterId: '',
  isPublic: false
})
const loading = ref(false)
const compatibleCharacters = computed(() => characters.value?.characters.filter((character) => character.systemId === form.systemId) || [])
const hasSystems = computed(() => Boolean(systems.value?.systems.length))

watch(() => form.systemId, () => {
  form.characterId = ''
})

async function submit() {
  loading.value = true
  try {
    const response = await $fetch<{ room: { id: string } }>('/api/rooms', {
      method: 'POST',
      body: { ...form, isPublic: false, characterId: form.characterId || null }
    })
    push('Sala criada.', 'success')
    await navigateTo(`/app/rooms/${response.room.id}`)
  } catch (error) {
    apiError(error, 'Nao foi possivel criar sala.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="page-title">Criar sala</h1>
      <p class="muted mt-1">Defina campanha, sistema, mestre e codigo de convite.</p>
    </div>
    <AppCard>
      <form class="grid gap-4 md:grid-cols-2" @submit.prevent="submit">
        <label><span class="label">Nome da campanha</span><input v-model="form.name" name="roomName" class="input" type="text"></label>
        <label><span class="label">Sistema *</span><select v-model="form.systemId" class="select" :disabled="!hasSystems"><option v-if="!hasSystems" value="">Nenhum sistema criado ainda</option><option v-for="system in systems?.systems" :key="system.id" :value="system.id">{{ system.name }}</option></select></label>
        <label><span class="label">Personagem do mestre</span><select v-model="form.characterId" class="select" :disabled="!compatibleCharacters.length"><option value="">{{ compatibleCharacters.length ? 'Nenhum' : 'Nenhum personagem disponível' }}</option><option v-for="character in compatibleCharacters" :key="character.id" :value="character.id">{{ character.name }}</option></select></label>
        <p v-if="!hasSystems" class="rounded-lg border border-ember/25 bg-ember/10 p-3 text-sm text-ember">Crie um sistema primeiro para abrir uma sala.</p>
        <p v-else-if="!compatibleCharacters.length" class="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-mist">Voce pode criar a sala sem personagem do mestre ou criar uma ficha compativel depois.</p>
        <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-mist">
          A sala aparece apenas para o mestre e para quem entrar pelo codigo.
        </div>
        <label class="md:col-span-2"><span class="label">Descricao</span><textarea v-model="form.description" rows="4" class="input" /></label>
        <div class="md:col-span-2"><AppButton type="submit" :loading="loading" :disabled="!hasSystems">Criar sala</AppButton></div>
      </form>
    </AppCard>
  </div>
</template>
