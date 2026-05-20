<script setup lang="ts">
import { Check, MessageCircle, Search, UserPlus, X } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

type SocialUser = { id: string; name: string; username?: string | null; avatarUrl?: string | null; profileColor?: string | null }
type FriendRequest = { id: string; status: string; sender?: SocialUser; receiver?: SocialUser }

const { push, apiError } = useToast()
const q = ref('')
const selectedFriend = ref<SocialUser | null>(null)
const message = ref('')
const { data, refresh } = await useFetch<{ friends: SocialUser[]; sent: FriendRequest[]; received: FriendRequest[] }>('/api/social/friends', { default: () => ({ friends: [], sent: [], received: [] }) })
const { data: searchData, refresh: searchUsers } = await useFetch<{ users: SocialUser[] }>(() => `/api/social/users?q=${encodeURIComponent(q.value)}`, { immediate: false, watch: false, default: () => ({ users: [] }) })
const { data: conversation, refresh: refreshConversation } = await useFetch<{ messages: Array<{ id: string; content: string; createdAt: string; sender: SocialUser }> }>(() => selectedFriend.value ? `/api/social/messages/${selectedFriend.value.id}` : '/api/social/messages/none', { immediate: false, watch: false, default: () => ({ messages: [] }) })

watch(q, async () => {
  if (q.value.trim().length >= 2) await searchUsers()
})

async function addFriend(id: string) {
  try {
    await $fetch('/api/social/friends', { method: 'POST', body: { userId: id } })
    push('Solicitacao enviada.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel enviar solicitacao.')
  }
}

async function answerRequest(id: string, status: 'ACCEPTED' | 'REJECTED') {
  try {
    await $fetch(`/api/social/friends/${id}`, { method: 'POST', body: { status } })
    push(status === 'ACCEPTED' ? 'Amigo adicionado.' : 'Solicitacao recusada.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel responder solicitacao.')
  }
}

async function openChat(friend: SocialUser) {
  selectedFriend.value = friend
  await nextTick()
  await refreshConversation()
}

async function sendMessage() {
  if (!selectedFriend.value || !message.value.trim()) return
  try {
    await $fetch(`/api/social/messages/${selectedFriend.value.id}`, { method: 'POST', body: { content: message.value } })
    message.value = ''
    await refreshConversation()
  } catch (error) {
    apiError(error, 'Nao foi possivel enviar mensagem.')
  }
}
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader title="Amigos e mensagens" description="Conecte-se com jogadores, acompanhe perfis e converse em privado." />

    <section class="grid gap-5 xl:grid-cols-[340px_1fr]">
      <div class="space-y-5">
        <AppCard>
          <h2 class="font-black text-white">Adicionar amigo</h2>
          <label class="relative mt-3 block">
            <Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-mist" />
            <input v-model="q" class="input pl-9" placeholder="Buscar nome, usuario ou email">
          </label>
          <div class="mt-3 space-y-2">
            <div v-for="user in searchData.users" :key="user.id" class="soft-row flex items-center justify-between gap-3 p-3">
              <div class="flex min-w-0 items-center gap-3">
                <AppAvatar :name="user.name" :src="user.avatarUrl" :color="user.profileColor" rounded="full" />
                <div class="min-w-0">
                <NuxtLink :to="`/app/profiles/${user.id}`" class="truncate font-black text-white hover:text-ember">{{ user.name }}</NuxtLink>
                  <p class="truncate text-xs text-mist">@{{ user.username }}</p>
                </div>
              </div>
              <button type="button" class="grid h-9 w-9 place-items-center rounded-lg text-ember hover:bg-white/10" @click="addFriend(user.id)">
                <UserPlus class="h-4 w-4" />
              </button>
            </div>
            <p v-if="q.length >= 2 && !searchData.users.length" class="text-sm text-mist">Nenhum usuario encontrado.</p>
          </div>
        </AppCard>

        <AppCard v-if="data.received.some((item) => item.status === 'PENDING')">
          <h2 class="font-black text-white">Solicitacoes</h2>
          <div class="mt-3 space-y-2">
            <div v-for="request in data.received.filter((item) => item.status === 'PENDING')" :key="request.id" class="soft-row flex items-center justify-between gap-3 p-3">
              <div class="flex min-w-0 items-center gap-3">
                <AppAvatar :name="request.sender?.name" :src="request.sender?.avatarUrl" :color="request.sender?.profileColor" rounded="full" />
                <NuxtLink v-if="request.sender" :to="`/app/profiles/${request.sender.id}`" class="truncate font-black text-white hover:text-ember">{{ request.sender.name }}</NuxtLink>
              </div>
              <div class="flex gap-1">
                <button class="grid h-8 w-8 place-items-center rounded-lg text-emerald-300 hover:bg-white/10" @click="answerRequest(request.id, 'ACCEPTED')"><Check class="h-4 w-4" /></button>
                <button class="grid h-8 w-8 place-items-center rounded-lg text-red-200 hover:bg-white/10" @click="answerRequest(request.id, 'REJECTED')"><X class="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <h2 class="font-black text-white">Amigos</h2>
          <div class="mt-3 space-y-2">
            <button v-for="friend in data.friends" :key="friend.id" type="button" class="soft-row flex w-full items-center gap-3 p-3 text-left" @click="openChat(friend)">
              <AppAvatar :name="friend.name" :src="friend.avatarUrl" :color="friend.profileColor" rounded="full" />
              <span class="min-w-0 flex-1">
                <NuxtLink :to="`/app/profiles/${friend.id}`" class="block truncate font-black text-white hover:text-ember" @click.stop>{{ friend.name }}</NuxtLink>
                <span class="block truncate text-xs text-mist">@{{ friend.username }}</span>
              </span>
              <MessageCircle class="h-4 w-4 text-ember" />
            </button>
            <EmptyState v-if="!data.friends.length" title="Nenhum amigo ainda" description="Busque jogadores pelo nome, usuario ou email para iniciar sua rede." />
          </div>
        </AppCard>
      </div>

      <AppCard class="flex min-h-[560px] flex-col p-0">
        <div class="border-b border-white/10 p-4">
          <h2 class="font-black text-white">{{ selectedFriend ? selectedFriend.name : 'Mensagens privadas' }}</h2>
          <p class="text-sm text-mist">{{ selectedFriend ? `@${selectedFriend.username}` : 'Selecione um amigo para abrir a conversa.' }}</p>
        </div>
        <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div v-for="item in conversation.messages" :key="item.id" class="max-w-[78%] rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-white" :class="item.sender.id === selectedFriend?.id ? '' : 'ml-auto bg-ember/15'">
            <p class="font-bold">{{ item.sender.name }}</p>
            <p class="mt-1 whitespace-pre-wrap leading-6">{{ item.content }}</p>
            <p class="mt-1 text-xs text-mist">{{ new Date(item.createdAt).toLocaleString('pt-BR') }}</p>
          </div>
          <EmptyState v-if="selectedFriend && !conversation.messages.length" title="Conversa vazia" description="Envie a primeira mensagem privada." />
        </div>
        <form v-if="selectedFriend" class="flex gap-2 border-t border-white/10 p-3" @submit.prevent="sendMessage">
          <input v-model="message" class="input" placeholder="Escreva sua mensagem...">
          <AppButton type="submit">Enviar</AppButton>
        </form>
      </AppCard>
    </section>
  </div>
</template>
