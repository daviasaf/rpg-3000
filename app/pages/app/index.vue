<script setup lang="ts">
import { Bot, BookOpen, Globe2, Heart, Plus, Swords, UserRound, UsersRound } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const [{ data: rooms }, { data: characters }, { data: systems }] = await Promise.all([
  useFetch<{ rooms: Array<{ id: string; name: string; system?: { name: string }; code: string; updatedAt: string }> }>('/api/rooms'),
  useFetch<{ characters: Array<{ id: string; name: string; avatarUrl?: string | null; system?: { name: string } }> }>('/api/characters'),
  useFetch<{ systems: Array<{ id: string; name: string; description: string; tags: string[]; visibility: string; _count?: { characters: number; rooms: number } }> }>('/api/systems')
])
const { push, apiError } = useToast()
const { data: feed, refresh: refreshFeed } = await useFetch<{ userId: string; items: Array<{
  id: string
  content: string
  createdAt: string
  metadataJson?: Record<string, unknown> | null
  likeUsers?: Array<{ id: string; name: string; avatarUrl?: string | null; profileColor?: string | null }>
  room: { id: string; name: string; system?: { name: string } | null }
}> }>('/api/feed')

async function likeFeed(id: string) {
  try {
    await $fetch(`/api/feed/${id}/like`, { method: 'POST' })
    await refreshFeed()
  } catch (error) {
    apiError(error, 'Nao foi possivel curtir.')
  }
}

async function removeShare(id: string) {
  try {
    await $fetch(`/api/feed/${id}`, { method: 'DELETE' })
    push('Compartilhamento apagado.', 'success')
    await refreshFeed()
  } catch (error) {
    apiError(error, 'Nao foi possivel apagar o compartilhamento.')
  }
}

function likes(item: { metadataJson?: Record<string, unknown> | null }) {
  return Array.isArray(item.metadataJson?.likes) ? item.metadataJson.likes.map(String) : []
}

function canRemoveShare(item: { metadataJson?: Record<string, unknown> | null }) {
  return item.metadataJson?.sharedByUserId === feed.value?.userId
}

function avatarLabel(name?: string) {
  return (name || '?').slice(0, 1).toUpperCase()
}

function userColor(user: { profileColor?: string | null }) {
  return user.profileColor || '#ff8a13'
}

const quick = [
  { to: '/app/systems/new', label: 'Criar sistema', description: 'Monte regras, campos e classes.', icon: BookOpen },
  { to: '/app/npcs/new', label: 'Criar NPC', description: 'Adicione personagens do mestre.', icon: Bot },
  { to: '/app/characters/new', label: 'Novo personagem', description: 'Crie uma ficha jogavel.', icon: UserRound },
  { to: '/app/rooms/new', label: 'Criar sala', description: 'Abra uma sessao para jogar.', icon: UsersRound },
  { to: '/app/rooms/join', label: 'Entrar por codigo', description: 'Acesse uma mesa existente.', icon: Plus },
  { to: '/app/community', label: 'Comunidade', description: 'Veja sistemas e NPCs publicados.', icon: Globe2 }
]
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-5">
      <div class="surface rounded-xl p-6">
        <p class="text-xs font-black uppercase tracking-[0.18em] text-ember">Comunidade</p>
        <h1 class="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Central RPG 3000</h1>
        <p class="mt-3 max-w-2xl text-mist">Gerencie campanhas, construa sistemas genericos e jogue sessoes com chat, log e rolagens reais.</p>
        <div class="mt-6 space-y-3">
          <NuxtLink v-for="item in quick" :key="item.to" :to="item.to" class="flex items-center gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-4 transition hover:border-ember/40 hover:bg-white/[0.07]">
            <span class="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-ember/20 bg-ember/10">
              <component :is="item.icon" class="h-5 w-5 text-ember" />
            </span>
            <span class="min-w-0">
              <span class="block font-bold text-white">{{ item.label }}</span>
              <span class="mt-0.5 block text-sm text-mist">{{ item.description }}</span>
            </span>
          </NuxtLink>
        </div>
      </div>
      <AppCard>
        <h2 class="text-lg font-black text-white">Feed recente</h2>
        <div class="mt-4 space-y-3">
          <div v-for="item in feed?.items" :key="item.id" class="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-mist">
            <p class="text-white">{{ item.content }}</p>
            <p class="mt-1 text-xs">{{ item.room.name }} | {{ new Date(item.createdAt).toLocaleString('pt-BR') }}</p>
            <div class="mt-3 flex items-center gap-2">
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-white hover:border-ember/40" @click="likeFeed(item.id)">
                <Heart class="h-3.5 w-3.5" :class="likes(item).includes(feed?.userId || '') ? 'fill-ember text-ember' : ''" />
                {{ likes(item).length }}
              </button>
              <button v-if="canRemoveShare(item)" type="button" class="rounded-md border border-flare/30 px-2 py-1 text-xs font-bold text-red-100 hover:bg-flare/10" @click="removeShare(item.id)">
                Apagar
              </button>
            </div>
            <div v-if="item.likeUsers?.length" class="mt-2 flex items-center gap-1">
              <span v-for="user in item.likeUsers.slice(0, 3)" :key="user.id" class="grid h-6 w-6 place-items-center overflow-hidden rounded-full border text-[10px] font-black text-white" :style="{ backgroundColor: `${userColor(user)}33`, borderColor: `${userColor(user)}66` }" :title="user.name">
                <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.name" class="h-full w-full object-cover">
                <span v-else>{{ avatarLabel(user.name) }}</span>
              </span>
              <span v-if="item.likeUsers.length > 3" class="text-xs font-bold text-mist">+{{ item.likeUsers.length - 3 }}</span>
            </div>
          </div>
          <p v-if="!feed?.items.length" class="text-sm text-mist">Compartilhe mensagens do sistema dentro de uma sala para elas aparecerem aqui.</p>
        </div>
      </AppCard>
    </section>

    <section class="space-y-5">
      <AppCard>
        <h2 class="mb-4 flex items-center gap-2 text-lg font-black text-white"><UsersRound class="h-5 w-5 text-ember" />Ultimas campanhas</h2>
        <div class="space-y-3">
          <NuxtLink v-for="room in rooms?.rooms.slice(0, 4)" :key="room.id" :to="`/app/rooms/${room.id}`" class="block rounded-lg border border-white/10 bg-white/[0.04] p-3 hover:border-ember/40">
            <b class="text-white">{{ room.name }}</b>
            <p class="text-sm text-mist">{{ room.system?.name }} | {{ room.code }}</p>
          </NuxtLink>
        </div>
      </AppCard>
      <AppCard>
        <h2 class="mb-4 flex items-center gap-2 text-lg font-black text-white"><UserRound class="h-5 w-5 text-ember" />Ultimos personagens</h2>
        <div class="space-y-3">
          <NuxtLink v-for="character in characters?.characters.slice(0, 4)" :key="character.id" :to="`/app/characters/${character.id}`" class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 hover:border-arcane/40">
            <div class="h-12 w-12 overflow-hidden rounded-lg border border-white/10 bg-arcane/20">
              <img v-if="character.avatarUrl" :src="character.avatarUrl" :alt="character.name" class="h-full w-full object-cover">
              <div v-else class="grid h-full place-items-center font-black text-ember">{{ character.name.slice(0, 1) }}</div>
            </div>
            <div><b class="text-white">{{ character.name }}</b><p class="text-sm text-mist">{{ character.system?.name }}</p></div>
          </NuxtLink>
        </div>
      </AppCard>
      <AppCard>
        <h2 class="mb-4 flex items-center gap-2 text-lg font-black text-white"><Swords class="h-5 w-5 text-ember" />Sistemas populares</h2>
        <div class="space-y-3">
          <NuxtLink v-for="system in systems?.systems.slice(0, 4)" :key="system.id" :to="`/app/systems/${system.id}`" class="block rounded-lg border border-white/10 bg-white/[0.04] p-3 hover:border-ember/40">
            <b class="text-white">{{ system.name }}</b>
            <p class="line-clamp-1 text-sm text-mist">{{ system.description }}</p>
          </NuxtLink>
        </div>
      </AppCard>
    </section>
  </div>
</template>
