<script setup lang="ts">
import { Check, MessageCircle, UserMinus, UserPlus } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const { push, apiError } = useToast()
const removeOpen = ref(false)
const removingFriend = ref(false)
const { data, refresh } = await useFetch<any>(`/api/social/profile/${route.params.id}`, {
  default: () => ({ profile: {}, posts: [], profileComments: [], systems: [], npcs: [], characters: [], social: {} })
})

const friendActionItems = [
  { key: 'remove', label: 'Remover amizade', icon: UserMinus, danger: true }
]

async function addFriend() {
  try {
    await $fetch('/api/social/friends', { method: 'POST', body: { userId: data.value.profile.id } })
    push('Solicitacao de amizade enviada.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Erro ao enviar solicitacao.')
  }
}

async function acceptRequest() {
  if (!data.value.social?.receivedRequestId) return
  try {
    await $fetch(`/api/social/friends/${data.value.social.receivedRequestId}`, { method: 'POST', body: { status: 'ACCEPTED' } })
    push('Solicitacao aceita.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Erro ao aceitar solicitacao.')
  }
}

async function removeFriend() {
  if (!data.value.profile?.id || data.value.social?.isSelf) return

  removingFriend.value = true
  try {
    await $fetch(`/api/social/friends/${data.value.profile.id}`, { method: 'DELETE' })
    removeOpen.value = false
    push('Amizade removida.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Erro ao remover amizade.')
  } finally {
    removingFriend.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="!data.social?.isSelf" class="flex flex-wrap justify-end gap-2">
      <NuxtLink v-if="data.social?.isFriend" :to="`/app/friends?chat=${data.profile.id}`">
        <AppButton><MessageCircle class="h-4 w-4" />Mensagem</AppButton>
      </NuxtLink>
      <AppActionMenu v-if="data.social?.isFriend" :items="friendActionItems" title="Acoes sociais" @select="removeOpen = true" />
      <AppButton v-else-if="data.social?.receivedRequestId" @click="acceptRequest"><Check class="h-4 w-4" />Aceitar amizade</AppButton>
      <AppButton v-else-if="!data.social?.sentRequestId" @click="addFriend"><UserPlus class="h-4 w-4" />Pedir amizade</AppButton>
      <span v-else class="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 text-sm font-bold text-mist">Solicitacao enviada</span>
    </div>

    <SocialProfileView
      :profile="data.profile"
      :posts="data.posts"
      :profile-comments="data.profileComments"
      :systems="data.systems"
      :npcs="data.npcs"
      :characters="data.characters"
      :own-profile="data.social?.isSelf"
      @refresh="refresh"
    />
    <ConfirmModal
      :open="removeOpen"
      title="Remover amizade"
      :message="`Remover ${data.profile?.name || 'este usuario'} da sua lista de amigos?`"
      confirm-label="Remover"
      :loading="removingFriend"
      @close="removeOpen = false"
      @confirm="removeFriend"
    />
  </div>
</template>
