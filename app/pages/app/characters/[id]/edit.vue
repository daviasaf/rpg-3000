<script setup lang="ts">
import { ArrowLeft, Save } from 'lucide-vue-next'
import type { SystemSchema } from '../../../../../shared/types/system'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const { push, apiError } = useToast()
const saving = ref(false)
const { data, refresh } = await useFetch<{ character: {
  id: string
  name: string
  description?: string | null
  avatarUrl?: string | null
  moderationStatus?: string | null
  moderationReason?: string | null
  dataJson: Record<string, unknown>
  system: { name: string; schemaJson?: SystemSchema; fields: Array<{ id?: string; key: string; label: string; type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'LIST' | 'FORMULA' | 'DICE'; category: 'ATTRIBUTE' | 'SKILL' | 'RESOURCE' | 'STATUS_BAR' | 'TEXT_FIELD' | 'NUMERIC_FIELD' | 'BOOLEAN_FIELD' | 'LIST_FIELD' | 'FORMULA' | 'ROLL_RULE'; defaultValue?: unknown; optionsJson?: unknown; formula?: string | null }> }
} }>(`/api/characters/${route.params.id}`)

const identity = reactive({
  name: '',
  description: '',
  avatarUrl: ''
})

const isRejected = computed(() => data.value?.character.moderationStatus === 'REJECTED')
const editableCharacter = computed(() => data.value?.character
  ? {
      ...data.value.character,
      name: identity.name || data.value.character.name,
      description: identity.description,
      avatarUrl: identity.avatarUrl
    }
  : null)

watch(() => data.value?.character, (character) => {
  if (!character) return
  identity.name = character.name || ''
  identity.description = character.description || ''
  identity.avatarUrl = character.avatarUrl || ''
}, { immediate: true })

async function saveIdentity() {
  if (!data.value?.character || isRejected.value) return
  if (identity.name.trim().length < 2) {
    push('Informe o nome do personagem.', 'error')
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/characters/${data.value.character.id}`, {
      method: 'PUT',
      body: {
        name: identity.name,
        description: identity.description,
        avatarUrl: identity.avatarUrl
      }
    })
    push('Personagem atualizado.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel editar o personagem.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="data?.character && editableCharacter" class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="page-title">Editar personagem</h1>
        <p class="muted mt-1">Atualize a apresentacao e os campos da ficha.</p>
      </div>
      <NuxtLink :to="`/app/characters/${data.character.id}`" class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-mist hover:text-white">
        <ArrowLeft class="h-4 w-4" />
        Voltar
      </NuxtLink>
    </div>

    <AppCard v-if="isRejected" class="border-flare/40 bg-flare/10">
      <h2 class="font-black text-white">Personagem rejeitado</h2>
      <p class="mt-2 text-sm text-red-100">{{ data.character.moderationReason || 'Este personagem esta bloqueado para edicao. Crie uma nova versao para enviar novamente.' }}</p>
    </AppCard>

    <AppCard>
      <div class="grid gap-4 md:grid-cols-2">
        <label><span class="label">Nome *</span><input v-model="identity.name" class="input" :disabled="isRejected"></label>
        <label><span class="label">Avatar por URL</span><input v-model="identity.avatarUrl" class="input" type="url" placeholder="https://..." :disabled="isRejected"></label>
        <label class="md:col-span-2"><span class="label">Descricao curta</span><textarea v-model="identity.description" rows="3" class="input" :disabled="isRejected" /></label>
      </div>
      <div class="mt-4 flex justify-end">
        <AppButton type="button" :loading="saving" :disabled="isRejected" @click="saveIdentity">
          <Save class="h-4 w-4" />
          Salvar identidade
        </AppButton>
      </div>
    </AppCard>

    <CharacterSheet :character="editableCharacter" :editable="!isRejected" @saved="refresh" />
  </div>
</template>

