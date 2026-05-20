<script setup lang="ts">
import { Bot, Plus, Settings, Trash2 } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { push, apiError } = useToast()
const { data, refresh } = await useFetch<{ npcs: Array<{
  id: string
  name: string
  description?: string | null
  isCommunity: boolean
  moderationStatus?: string
  moderationReason?: string | null
  system?: { id: string; name: string } | null
  avatarUrl?: string | null
  createdBy?: { name: string } | null
  dataJson: Record<string, unknown>
}> }>('/api/npcs')

const settingsOpen = ref('')

async function deleteNpc(id: string) {
  try {
    await $fetch(`/api/npcs/${id}`, { method: 'DELETE' })
    push('NPC apagado.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel apagar NPC.')
  }
}

async function publishNpc(id: string) {
  try {
    await $fetch(`/api/npcs/${id}/publish`, { method: 'POST' })
    push('NPC enviado para analise da comunidade.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel publicar NPC.')
  }
}
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader title="NPCs" description="Seu inventario de NPCs. Itens da comunidade entram aqui como copias independentes.">
      <template #actions>
        <NuxtLink to="/app/npcs/new"><AppButton><Plus class="h-4 w-4" />Criar NPC</AppButton></NuxtLink>
      </template>
    </AppPageHeader>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <AppCard v-for="npc in data?.npcs" :key="npc.id">
        <div class="flex items-start justify-between gap-3">
          <NuxtLink :to="`/app/npcs/${npc.id}`" class="flex min-w-0 flex-1 gap-3 hover:text-ember">
            <AppAvatar :name="npc.name" :src="npc.avatarUrl" size="md" />
            <span class="min-w-0">
            <h2 class="truncate text-lg font-black text-white">{{ npc.name }}</h2>
            <p class="mt-1 text-sm text-mist">{{ npc.description || 'Sem descricao.' }}</p>
            <p class="mt-2 text-xs text-mist">
              {{ npc.system?.name || 'Generico' }} |
              {{ npc.moderationStatus === 'PENDING' ? 'Em analise' : npc.moderationStatus === 'REJECTED' ? 'Rejeitado' : npc.isCommunity ? 'Comunidade' : 'Privado' }}
            </p>
            </span>
          </NuxtLink>
          <div class="relative">
            <button type="button" class="rounded-lg border border-white/10 p-2 text-mist hover:text-white" title="Configurar NPC" @click="settingsOpen = settingsOpen === npc.id ? '' : npc.id">
              <Settings class="h-4 w-4" />
            </button>
            <div v-if="settingsOpen === npc.id" class="absolute right-0 top-10 z-50 w-40 rounded-lg border border-white/10 bg-panel p-1 shadow-soft">
              <NuxtLink v-if="npc.moderationStatus !== 'REJECTED'" :to="`/app/npcs/${npc.id}/edit`" class="block rounded-md px-3 py-2 text-sm font-bold text-white hover:bg-white/10">Editar</NuxtLink>
              <button v-if="npc.moderationStatus !== 'REJECTED'" type="button" class="block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-white hover:bg-white/10" @click="publishNpc(npc.id); settingsOpen = ''">Publicar</button>
              <button type="button" class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-red-100 hover:bg-flare/15" @click="deleteNpc(npc.id)"><Trash2 class="h-4 w-4" />Apagar</button>
            </div>
          </div>
        </div>
        <div v-if="Array.isArray(npc.dataJson.attacks)" class="mt-4 flex flex-wrap gap-2">
          <span v-for="attack in npc.dataJson.attacks" :key="String((attack as Record<string, unknown>).name)" class="rounded-md border border-ember/25 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">
            {{ (attack as Record<string, unknown>).name }}: {{ (attack as Record<string, unknown>).damage }}
          </span>
        </div>
        <p v-if="npc.moderationStatus === 'REJECTED'" class="mt-3 rounded-lg border border-flare/35 bg-flare/10 p-3 text-sm font-bold text-red-100">
          Rejeitado{{ npc.moderationReason ? `: ${npc.moderationReason}` : '. Bloqueado para edicao.' }}
        </p>
      </AppCard>
    </div>

    <EmptyState v-if="!data?.npcs.length" :icon="Bot" title="Voce ainda nao tem NPCs" description="Crie aliados, monstros e personagens do mestre para reutilizar nas cenas.">
    </EmptyState>
  </div>
</template>
