<script setup lang="ts">
import { Bot, BookOpen, CalendarClock, CircleDot, Globe2, Heart, LogIn, MessageSquareText, Plus, Radio, Swords, UserRound, UsersRound } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

type HomeRoom = {
  id: string
  name: string
  description?: string | null
  system?: { name: string }
  code: string
  updatedAt: string
  master?: { name: string }
  members?: unknown[]
  _count?: { members: number }
  sessions?: Array<{ id: string; status: string; startedAt: string; endedAt?: string | null }>
}

const [{ data: rooms }, { data: characters }, { data: systems }] = await Promise.all([
  useFetch<{ rooms: HomeRoom[] }>('/api/rooms'),
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
  { to: '/app/rooms/new', label: 'Criar sala', description: 'Abra uma mesa para jogar.', icon: UsersRound },
  { to: '/app/rooms/join', label: 'Entrar por codigo', description: 'Acesse uma campanha existente.', icon: LogIn },
  { to: '/app/characters/new', label: 'Novo personagem', description: 'Crie uma ficha jogavel.', icon: UserRound },
  { to: '/app/systems/new', label: 'Criar sistema', description: 'Monte regras e campos.', icon: BookOpen },
  { to: '/app/npcs/new', label: 'Criar NPC', description: 'Prepare aliados e ameacas.', icon: Bot },
  { to: '/app/community', label: 'Comunidade', description: 'Explore conteudo publicado.', icon: Globe2 }
]

const allRooms = computed(() => rooms.value?.rooms || [])
const allCharacters = computed(() => characters.value?.characters || [])
const allSystems = computed(() => systems.value?.systems || [])
const activeRooms = computed(() => allRooms.value.filter((room) => room.sessions?.[0]?.status === 'ACTIVE'))
const continueRoom = computed(() => activeRooms.value[0] || allRooms.value[0])

function relativeDate(date?: string) {
  if (!date) return 'Sem atividade'
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.max(1, Math.round(diff / 60000))
  if (minutes < 60) return `${minutes} min atras`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h atras`
  const days = Math.round(hours / 24)
  return `${days} d atras`
}
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      eyebrow="Workspace"
      title="Inicio"
      description="Um painel rapido para voltar para a mesa certa, acompanhar atividade e preparar a proxima sessao."
    >
      <template #actions>
        <NuxtLink to="/app/rooms/new"><AppButton><Plus class="h-4 w-4" />Nova sala</AppButton></NuxtLink>
      </template>
    </AppPageHeader>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Campanhas" :value="allRooms.length" hint="Mesas onde voce joga ou mestra" :icon="UsersRound" />
      <MetricCard label="Sessoes abertas" :value="activeRooms.length" hint="Prontas para entrar agora" :icon="Radio" tone="green" />
      <MetricCard label="Personagens" :value="allCharacters.length" hint="Fichas disponiveis" :icon="UserRound" tone="blue" />
      <MetricCard label="Sistemas" :value="allSystems.length" hint="Regras publicas e suas criacoes" :icon="BookOpen" tone="arcane" />
    </section>

    <section class="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
      <AppCard class="p-0">
        <div class="border-b border-white/10 p-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.12em] text-ember">Continuar</p>
              <h2 class="mt-2 text-2xl font-black text-white">
                {{ continueRoom?.name || 'Nenhuma campanha ainda' }}
              </h2>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-mist">
                <template v-if="continueRoom">
                  {{ continueRoom.system?.name }} · codigo {{ continueRoom.code }} · {{ relativeDate(continueRoom.updatedAt) }}
                </template>
                <template v-else>
                  Crie uma sala ou entre por codigo para iniciar seu primeiro workspace de mesa.
                </template>
              </p>
            </div>
            <NuxtLink v-if="continueRoom" :to="`/app/rooms/${continueRoom.id}`">
              <AppButton><Swords class="h-4 w-4" />Entrar na mesa</AppButton>
            </NuxtLink>
          </div>
        </div>
        <div class="grid gap-3 p-4 md:grid-cols-3">
          <NuxtLink
            v-for="room in allRooms.slice(0, 3)"
            :key="room.id"
            :to="`/app/rooms/${room.id}`"
            class="soft-row p-4"
          >
            <div class="flex items-center gap-2 text-xs font-bold text-mist">
              <CircleDot class="h-3.5 w-3.5" :class="room.sessions?.[0]?.status === 'ACTIVE' ? 'text-emerald-300' : 'text-mist'" />
              {{ room.sessions?.[0]?.status === 'ACTIVE' ? 'Sessao ativa' : 'Campanha' }}
            </div>
            <p class="mt-2 truncate font-black text-white">{{ room.name }}</p>
            <p class="mt-1 text-sm text-mist">{{ room._count?.members ?? room.members?.length ?? 0 }} jogadores</p>
          </NuxtLink>
        </div>
      </AppCard>

      <AppCard>
        <h2 class="flex items-center gap-2 text-lg font-black text-white">
          <CalendarClock class="h-5 w-5 text-ember" /> Proximas acoes
        </h2>
        <div class="mt-4 grid gap-2">
          <NuxtLink v-for="item in quick" :key="item.to" :to="item.to" class="soft-row flex items-center gap-3 p-3">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-ember">
              <component :is="item.icon" class="h-4 w-4" />
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-black text-white">{{ item.label }}</span>
              <span class="block truncate text-xs text-mist">{{ item.description }}</span>
            </span>
          </NuxtLink>
        </div>
      </AppCard>
    </section>

    <section class="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <AppCard>
        <div class="flex items-center justify-between gap-3">
          <h2 class="flex items-center gap-2 text-lg font-black text-white"><UserRound class="h-5 w-5 text-ember" />Personagens</h2>
          <NuxtLink to="/app/characters" class="text-sm font-bold text-mist hover:text-white">Ver todos</NuxtLink>
        </div>
        <div class="mt-4 space-y-2">
          <NuxtLink v-for="character in allCharacters.slice(0, 4)" :key="character.id" :to="`/app/characters/${character.id}`" class="soft-row flex items-center gap-3 p-3">
            <div class="h-11 w-11 overflow-hidden rounded-lg border border-white/10 bg-arcane/15">
              <img v-if="character.avatarUrl" :src="character.avatarUrl" :alt="character.name" class="h-full w-full object-cover">
              <div v-else class="grid h-full place-items-center font-black text-ember">{{ character.name.slice(0, 1) }}</div>
            </div>
            <div class="min-w-0">
              <b class="block truncate text-white">{{ character.name }}</b>
              <p class="truncate text-sm text-mist">{{ character.system?.name }}</p>
            </div>
          </NuxtLink>
          <EmptyState v-if="!allCharacters.length" :icon="UserRound" title="Nenhum personagem" description="Crie uma ficha para entrar nas sessoes com tudo pronto.">
            <NuxtLink to="/app/characters/new"><AppButton>Novo personagem</AppButton></NuxtLink>
          </EmptyState>
        </div>
      </AppCard>

      <AppCard>
        <h2 class="flex items-center gap-2 text-lg font-black text-white">
          <MessageSquareText class="h-5 w-5 text-ember" /> Atividade recente
        </h2>
        <div class="mt-4 space-y-3">
          <article v-for="item in feed?.items" :key="item.id" class="soft-row p-4 text-sm text-mist">
            <p class="leading-6 text-white">{{ item.content }}</p>
            <p class="mt-2 text-xs">{{ item.room.name }} · {{ new Date(item.createdAt).toLocaleString('pt-BR') }}</p>
            <div class="mt-3 flex items-center gap-2">
              <button type="button" class="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-white hover:border-ember/40" @click="likeFeed(item.id)">
                <Heart class="h-3.5 w-3.5" :class="likes(item).includes(feed?.userId || '') ? 'fill-ember text-ember' : ''" />
                {{ likes(item).length }}
              </button>
              <button v-if="canRemoveShare(item)" type="button" class="rounded-md border border-flare/30 px-2 py-1 text-xs font-bold text-red-100 hover:bg-flare/10" @click="removeShare(item.id)">
                Apagar
              </button>
              <div v-if="item.likeUsers?.length" class="ml-auto flex items-center gap-1">
                <span v-for="user in item.likeUsers.slice(0, 3)" :key="user.id" class="grid h-6 w-6 place-items-center overflow-hidden rounded-full border text-[10px] font-black text-white" :style="{ backgroundColor: `${userColor(user)}33`, borderColor: `${userColor(user)}66` }" :title="user.name">
                  <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.name" class="h-full w-full object-cover">
                  <span v-else>{{ avatarLabel(user.name) }}</span>
                </span>
              </div>
            </div>
          </article>
          <EmptyState v-if="!feed?.items.length" :icon="MessageSquareText" title="Sem atividade compartilhada" description="Compartilhe eventos ou rolagens importantes dentro de uma sala para criar memoria da campanha." />
        </div>
      </AppCard>
    </section>
  </div>
</template>
