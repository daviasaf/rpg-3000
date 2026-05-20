<script setup lang="ts">
import { Check, MessageCircle, UserMinus, UserPlus } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const { push, apiError } = useToast()
const { data, refresh } = await useFetch<any>(`/api/social/profile/${route.params.id}`, {
  default: () => ({ profile: {}, posts: [], profileComments: [], systems: [], npcs: [], characters: [], social: {} })
})

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
  if (!confirm(`Remover ${data.value.profile.name} da sua lista de amigos?`)) return

  try {
    await $fetch(`/api/social/friends/${data.value.profile.id}`, { method: 'DELETE' })
    push('Amizade removida.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Erro ao remover amizade.')
  }
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="!data.social?.isSelf" class="flex flex-wrap justify-end gap-2">
      <NuxtLink v-if="data.social?.isFriend" :to="`/app/friends?chat=${data.profile.id}`">
        <AppButton><MessageCircle class="h-4 w-4" />Mensagem</AppButton>
      </NuxtLink>
      <AppButton v-if="data.social?.isFriend" variant="ghost" @click="removeFriend"><UserMinus class="h-4 w-4" />Remover amizade</AppButton>
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
  </div>
</template>
