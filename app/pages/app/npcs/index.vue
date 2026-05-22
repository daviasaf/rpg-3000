<script setup lang="ts">
import { Bot, Edit3, Plus, Send, Star, Trash2 } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { push, apiError } = useToast()
const { data, refresh } = await useFetch<{ npcs: Array<{
  id: string
  name: string
  description?: string | null
  isCommunity: boolean
  moderationStatus?: string
  moderationReason?: string | null
  featuredOnProfile?: boolean
  system?: { id: string; name: string } | null
  avatarUrl?: string | null
  createdBy?: { name: string } | null
  dataJson: Record<string, unknown>
}> }>('/api/npcs')

const busyId = ref('')
const featuringId = ref('')

async function deleteNpc(id: string) {
  if (busyId.value) {
    push('Essa acao ja esta sendo processada.', 'info')
    return
  }
  busyId.value = id
  try {
    await $fetch(`/api/npcs/${id}`, { method: 'DELETE' })
    push('NPC apagado.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel apagar NPC.')
  } finally {
    busyId.value = ''
  }
}

async function publishNpc(id: string) {
  if (busyId.value) {
    push('Essa acao ja esta sendo processada.', 'info')
    return
  }
  busyId.value = id
  try {
    await $fetch(`/api/npcs/${id}/publish`, { method: 'POST' })
    push('NPC enviado para analise da comunidade.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel publicar NPC.')
  } finally {
    busyId.value = ''
  }
}

function actionItems(npc: { id: string, moderationStatus?: string, featuredOnProfile?: boolean }) {
  return [
    { key: 'edit', label: 'Editar', icon: Edit3, disabled: npc.moderationStatus === 'REJECTED' },
    { key: 'publish', label: npc.moderationStatus === 'PENDING' ? 'Em analise' : 'Publicar', icon: Send, disabled: npc.moderationStatus === 'REJECTED' || npc.moderationStatus === 'PENDING' || busyId.value === npc.id },
    {
      key: 'feature',
      label: npc.featuredOnProfile ? 'Remover destaque' : 'Destacar no perfil',
      icon: Star,
      disabled: npc.moderationStatus !== 'APPROVED' || featuringId.value === npc.id
    },
    { key: 'delete', label: 'Apagar', icon: Trash2, danger: true, disabled: busyId.value === npc.id }
  ]
}

async function handleAction(npc: { id: string, featuredOnProfile?: boolean }, action: string) {
  if (action === 'edit') await navigateTo(`/app/npcs/${npc.id}/edit`)
  if (action === 'publish') await publishNpc(npc.id)
  if (action === 'feature') await toggleFeatured(npc)
  if (action === 'delete') await deleteNpc(npc.id)
}

async function toggleFeatured(npc: { id: string, featuredOnProfile?: boolean }) {
  if (featuringId.value) return
  featuringId.value = npc.id
  try {
    const response = await $fetch<{ featured: boolean }>('/api/profile/featured', {
      method: 'POST',
      body: { type: 'NPC', id: npc.id, featured: !npc.featuredOnProfile }
    })
    ;(npc as { featuredOnProfile?: boolean }).featuredOnProfile = response.featured
    push(response.featured ? 'NPC destacado no perfil.' : 'Destaque removido do perfil.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel alterar o destaque.')
  } finally {
    featuringId.value = ''
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
          <AppActionMenu title="Acoes do NPC" :items="actionItems(npc)" @select="handleAction(npc, $event)" />
        </div>
        <p v-if="npc.featuredOnProfile" class="mt-3 inline-flex items-center gap-2 rounded-md border border-ember/25 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">
          <Star class="h-3.5 w-3.5" />Destacado no perfil
        </p>
        <div v-if="Array.isArray(npc.dataJson.attacks)" class="mt-4 flex flex-wrap gap-2">
          <span v-for="attack in npc.dataJson.attacks" :key="String((attack as Record<string, unknown>).name)" class="rounded-md border border-ember/25 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">
            {{ (attack as Record<string, unknown>).name }}: {{ (attack as Record<string, unknown>).damage }}
          </span>
        </div>
        <p v-if="npc.moderationStatus === 'PENDING'" class="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm font-bold text-amber-100">
          Este NPC ainda esta em analise. Voce pode editar ou apagar, mas nao pode publicar novamente, destacar ou usar em sessao ate ser aprovado.
        </p>
        <p v-if="npc.moderationStatus === 'REJECTED'" class="mt-3 rounded-lg border border-flare/35 bg-flare/10 p-3 text-sm font-bold text-red-100">
          Rejeitado{{ npc.moderationReason ? `: ${npc.moderationReason}` : '. Bloqueado para edicao.' }}
        </p>
      </AppCard>
    </div>

    <EmptyState v-if="!data?.npcs.length" :icon="Bot" title="Voce ainda nao tem NPCs" description="Crie aliados, monstros e personagens do mestre para reutilizar nas cenas.">
    </EmptyState>
  </div>
</template>

