<script setup lang="ts">
import { ArrowLeft, Settings } from 'lucide-vue-next'
import type { SystemSchema } from '../../../../shared/types/system'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const { push, apiError } = useToast()
const deleting = ref(false)
const settingsOpen = ref(false)
const confirmDeleteOpen = ref(false)
const { data, refresh } = await useFetch<{ character: {
  id: string
  name: string
  description?: string | null
  avatarUrl?: string | null
  dataJson: Record<string, unknown>
  system: { name: string; schemaJson?: SystemSchema; fields: Array<{ id?: string; key: string; label: string; type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'LIST' | 'FORMULA' | 'DICE'; category: 'ATTRIBUTE' | 'SKILL' | 'RESOURCE' | 'STATUS_BAR' | 'TEXT_FIELD' | 'NUMERIC_FIELD' | 'BOOLEAN_FIELD' | 'LIST_FIELD' | 'FORMULA' | 'ROLL_RULE'; defaultValue?: unknown; optionsJson?: unknown; formula?: string | null }> }
} }>(`/api/characters/${route.params.id}`)

async function deleteCharacter() {
  if (!data.value?.character) return

  deleting.value = true
  try {
    await $fetch(`/api/characters/${data.value.character.id}`, { method: 'DELETE' })
    push('Personagem apagado.', 'success')
    await navigateTo('/app/characters')
  } catch (error) {
    apiError(error, 'Nao foi possivel apagar o personagem.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div v-if="data?.character" class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <NuxtLink to="/app/characters" class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-mist hover:text-white">
        <ArrowLeft class="h-4 w-4" />
        Voltar
      </NuxtLink>
      <div class="relative">
        <button type="button" class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-mist hover:text-white" @click="settingsOpen = !settingsOpen">
          <Settings class="h-5 w-5" />
        </button>
        <div v-if="settingsOpen" class="absolute right-0 top-12 z-10 w-48 rounded-lg border border-white/10 bg-panel p-1 shadow-soft">
          <button type="button" class="block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-red-100 hover:bg-flare/15" @click="confirmDeleteOpen = true; settingsOpen = false">Apagar personagem</button>
        </div>
      </div>
    </div>
    <CharacterSheet :character="data.character" editable @saved="refresh" />
    <ConfirmModal
      :open="confirmDeleteOpen"
      title="Apagar personagem"
      :message="`Tem certeza que deseja apagar ${data.character.name}?`"
      confirm-label="Apagar"
      :loading="deleting"
      @close="confirmDeleteOpen = false"
      @confirm="deleteCharacter"
    />
  </div>
</template>
