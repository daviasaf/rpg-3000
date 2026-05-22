<script setup lang="ts">
import { ArrowLeft, Edit3, Send, Star, Trash2 } from 'lucide-vue-next'
import type { SystemSchema } from '../../../../../shared/types/system'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const { push, apiError } = useToast()
const deleting = ref(false)
const confirmDeleteOpen = ref(false)
const publishOpen = ref(false)
const publishing = ref(false)
const featuring = ref(false)
const { data, refresh } = await useFetch<{ character: {
  id: string
  name: string
  description?: string | null
  avatarUrl?: string | null
  moderationStatus?: string | null
  moderationReason?: string | null
  featuredOnProfile?: boolean
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

function actionItems() {
  const character = data.value?.character
  return [
    { key: 'edit', label: 'Editar', icon: Edit3, disabled: character?.moderationStatus === 'REJECTED' },
    { key: 'publish', label: character?.moderationStatus === 'PENDING' ? 'Em analise' : 'Postar na comunidade', icon: Send, disabled: character?.moderationStatus === 'REJECTED' || character?.moderationStatus === 'PENDING' || publishing.value },
    {
      key: 'feature',
      label: character?.featuredOnProfile ? 'Remover destaque' : 'Destacar no perfil',
      icon: Star,
      disabled: character?.moderationStatus !== 'APPROVED' || featuring.value
    },
    { key: 'delete', label: 'Apagar personagem', icon: Trash2, danger: true, disabled: deleting.value }
  ]
}

async function handleAction(action: string) {
  const character = data.value?.character
  if (!character) return
  if (action === 'edit') await navigateTo(`/app/characters/${character.id}/edit`)
  if (action === 'publish') publishOpen.value = true
  if (action === 'feature') await toggleFeatured()
  if (action === 'delete') confirmDeleteOpen.value = true
}

async function publishCharacter() {
  const character = data.value?.character
  if (!character) return
  publishing.value = true
  try {
    await $fetch(`/api/characters/${character.id}/publish`, { method: 'POST' })
    push('Personagem enviado para analise da comunidade.', 'success')
    publishOpen.value = false
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel postar o personagem.')
  } finally {
    publishing.value = false
  }
}

async function toggleFeatured() {
  const character = data.value?.character
  if (!character || featuring.value) return
  featuring.value = true
  try {
    const response = await $fetch<{ featured: boolean }>('/api/profile/featured', {
      method: 'POST',
      body: { type: 'CHARACTER', id: character.id, featured: !character.featuredOnProfile }
    })
    character.featuredOnProfile = response.featured
    push(response.featured ? 'Personagem destacado no perfil.' : 'Destaque removido do perfil.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel alterar o destaque.')
  } finally {
    featuring.value = false
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
      <AppActionMenu title="Acoes do personagem" :items="actionItems()" @select="handleAction" />
    </div>
    <p v-if="data.character.featuredOnProfile" class="inline-flex items-center gap-2 rounded-md border border-ember/25 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">
      <Star class="h-3.5 w-3.5" />Destacado no perfil
    </p>
    <AppCard v-if="data.character.moderationStatus === 'REJECTED'" class="border-flare/40 bg-flare/10">
      <h2 class="font-black text-white">Personagem rejeitado</h2>
      <p class="mt-2 text-sm text-red-100">{{ data.character.moderationReason || 'Este personagem esta bloqueado para edicao. Crie uma nova versao para enviar novamente.' }}</p>
    </AppCard>
    <AppCard v-if="data.character.moderationStatus === 'PENDING'" class="border-amber-300/30 bg-amber-300/10">
      <h2 class="font-black text-white">Personagem em analise</h2>
      <p class="mt-2 text-sm text-amber-100">Voce pode editar ou apagar esta ficha, mas ela nao pode entrar em sala, ser destacada ou publicada novamente ate ser aprovada.</p>
    </AppCard>
    <CharacterSheet :character="data.character" :editable="data.character.moderationStatus !== 'REJECTED'" @saved="refresh" />
    <ConfirmModal
      :open="confirmDeleteOpen"
      title="Apagar personagem"
      :message="`Tem certeza que deseja apagar ${data.character.name}?`"
      confirm-label="Apagar"
      :loading="deleting"
      @close="confirmDeleteOpen = false"
      @confirm="deleteCharacter"
    />
    <ConfirmModal
      :open="publishOpen"
      title="Postar personagem"
      message="Uma copia da ficha sera enviada para analise da comunidade. Mudancas futuras na ficha pessoal nao alteram esse snapshot."
      confirm-label="Postar"
      :loading="publishing"
      @close="publishOpen = false"
      @confirm="publishCharacter"
    />
  </div>
</template>

