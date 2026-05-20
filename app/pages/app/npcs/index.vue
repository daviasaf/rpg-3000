<script setup lang="ts">
import { Plus, Settings, Trash2 } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { push, apiError } = useToast()
const { data, refresh } = await useFetch<{ npcs: Array<{
  id: string
  name: string
  description?: string | null
  isCommunity: boolean
  moderationStatus?: string
  system?: { id: string; name: string } | null
  createdBy?: { name: string } | null
  dataJson: Record<string, unknown>
}> }>('/api/npcs')

const editingId = ref('')
const settingsOpen = ref('')

async function updateNpc(npc: { id: string; name: string; description?: string | null; isCommunity: boolean; system?: { id: string } | null; dataJson: Record<string, unknown> }) {
  try {
    await $fetch(`/api/npcs/${npc.id}`, {
      method: 'PUT',
      body: {
        name: npc.name,
        description: npc.description,
        systemId: npc.system?.id || null,
        isCommunity: npc.isCommunity,
        dataJson: npc.dataJson
      }
    })
    editingId.value = ''
    push('NPC atualizado.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel editar NPC.')
  }
}

async function deleteNpc(id: string) {
  try {
    await $fetch(`/api/npcs/${id}`, { method: 'DELETE' })
    push('NPC apagado.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel apagar NPC.')
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="page-title">NPCs</h1>
        <p class="muted mt-1">Seu inventario de NPCs. Itens da comunidade entram aqui como copias independentes.</p>
      </div>
      <NuxtLink to="/app/npcs/new"><AppButton><Plus class="h-4 w-4" />Criar NPC</AppButton></NuxtLink>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="npc in data?.npcs" :key="npc.id">
        <div class="flex items-start justify-between gap-3">
          <NuxtLink :to="`/app/npcs/${npc.id}`" class="min-w-0 hover:text-ember">
            <h2 class="text-lg font-black text-white">{{ npc.name }}</h2>
            <p class="mt-1 text-sm text-mist">{{ npc.description || 'Sem descricao.' }}</p>
            <p class="mt-2 text-xs text-mist">
              {{ npc.system?.name || 'Generico' }} |
              {{ npc.moderationStatus === 'PENDING' ? 'Em analise' : npc.moderationStatus === 'REJECTED' ? 'Rejeitado' : npc.isCommunity ? 'Comunidade' : 'Privado' }}
            </p>
          </NuxtLink>
          <div class="relative">
            <button type="button" class="rounded-lg border border-white/10 p-2 text-mist hover:text-white" title="Configurar NPC" @click="settingsOpen = settingsOpen === npc.id ? '' : npc.id">
              <Settings class="h-4 w-4" />
            </button>
            <div v-if="settingsOpen === npc.id" class="absolute right-0 top-10 z-10 w-40 rounded-lg border border-white/10 bg-panel p-1 shadow-soft">
              <button type="button" class="block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-white hover:bg-white/10" @click="editingId = npc.id; settingsOpen = ''">Editar</button>
              <button type="button" class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-red-100 hover:bg-flare/15" @click="deleteNpc(npc.id)"><Trash2 class="h-4 w-4" />Apagar</button>
            </div>
          </div>
        </div>
        <div v-if="Array.isArray(npc.dataJson.attacks)" class="mt-4 flex flex-wrap gap-2">
          <span v-for="attack in npc.dataJson.attacks" :key="String((attack as Record<string, unknown>).name)" class="rounded-md border border-ember/25 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">
            {{ (attack as Record<string, unknown>).name }}: {{ (attack as Record<string, unknown>).damage }}
          </span>
        </div>
        <div v-if="editingId === npc.id" class="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <label><span class="label">Descricao</span><input v-model="npc.description" class="input"></label>
          <label class="mt-3 flex items-center gap-3"><input v-model="npc.isCommunity" type="checkbox" class="h-4 w-4 accent-ember"><span class="font-bold text-white">Aparecer na comunidade</span></label>
          <AppButton class="mt-3" type="button" @click="updateNpc(npc)">Salvar NPC</AppButton>
        </div>
      </AppCard>
    </div>

    <AppCard v-if="!data?.npcs.length">
      <p class="text-mist">Voce ainda nao tem NPCs no inventario.</p>
    </AppCard>
  </div>
</template>
