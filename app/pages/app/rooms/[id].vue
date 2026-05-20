<script setup lang="ts">
import { Crown, Eye, MessageCircle, MoreHorizontal, Settings, X } from 'lucide-vue-next'
import type { SystemSchema } from '../../../../shared/types/system'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const auth = useAuthStore()
const chat = ref<{ load: () => Promise<void> } | null>(null)
const { push, apiError } = useToast()
const deleting = ref(false)
const settingsOpen = ref(false)
const confirmDeleteOpen = ref(false)
const { data, refresh, error } = await useFetch<{ room: {
  id: string
  name: string
  description?: string | null
  code: string
  masterId: string
  system: {
    name: string
    schemaJson?: { primaryResource?: string }
    fields: Array<{ key: string; label: string; type: string; category: string }>
  }
  sessions: Array<{ id: string; status: string }>
  members: Array<{ id: string; role: string; user?: { id: string; name: string; profileColor?: string | null }; character?: {
    id: string
    name: string
    description?: string | null
    avatarUrl?: string | null
    dataJson?: Record<string, unknown> | null
    system?: { name: string; schemaJson?: SystemSchema; fields: Array<{ id?: string; key: string; label: string; type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'LIST' | 'FORMULA' | 'DICE'; category: 'ATTRIBUTE' | 'SKILL' | 'RESOURCE' | 'STATUS_BAR' | 'TEXT_FIELD' | 'NUMERIC_FIELD' | 'BOOLEAN_FIELD' | 'LIST_FIELD' | 'FORMULA' | 'ROLL_RULE'; defaultValue?: unknown; optionsJson?: unknown; formula?: string | null }> }
  } | null }>
} }>(`/api/rooms/${route.params.id}`)

watch(error, async (next) => {
  if (!next) return
  push('Esta sala nao existe mais.', 'info')
  await navigateTo('/app')
})

const isMaster = computed(() => data.value?.room.masterId === auth.user?.id)
const myCharacter = computed(() => data.value?.room.members.find((member) => member.user?.id === auth.user?.id)?.character)
const primaryResource = computed(() => data.value?.room.system.schemaJson?.primaryResource || 'vida')
const selectedDmUserId = ref<string | null>(null)
const memberMenuId = ref<string | null>(null)
const viewingMemberId = ref<string | null>(null)
const unreadByUserId = reactive<Record<string, number>>({})
const onlineUserIds = ref(new Set<string>())
const userAccent = ref('#ff8a13')
let roomTimer: ReturnType<typeof setInterval> | null = null
let presenceTimer: ReturnType<typeof setInterval> | null = null
let leavingRoom = false

function memberColor(userId?: string | null) {
  if (!userId) return '#ff8a13'
  if (userId === auth.user?.id) return userAccent.value || auth.user?.profileColor || '#ff8a13'
  return data.value?.room.members.find((member) => member.user?.id === userId)?.user?.profileColor || '#ff8a13'
}

function canSeeMemberSheet(member: { user?: { id: string } | null }) {
  return isMaster.value || member.user?.id === auth.user?.id
}

function openDm(member: { user?: { id: string } | null }) {
  if (!canOpenDm(member)) return
  if (!member.user?.id) return
  selectedDmUserId.value = member.user.id
  memberMenuId.value = null
  clearDm(member.user.id)
}

function closeDm() {
  selectedDmUserId.value = null
}

function canOpenDm(member: { user?: { id: string } | null }) {
  return Boolean(isOnline(member) && member.user?.id && member.user.id !== auth.user?.id)
}

function canViewSheet(member: { user?: { id: string } | null; character?: { dataJson?: Record<string, unknown> | null } | null }) {
  return Boolean(isMaster.value && isOnline(member) && member.character?.dataJson && member.user?.id !== auth.user?.id)
}

function openSheet(member: { id: string }) {
  viewingMemberId.value = member.id
  memberMenuId.value = null
}

const viewingCharacter = computed(() => {
  const member = data.value?.room.members.find((item) => item.id === viewingMemberId.value)
  if (!member?.character?.dataJson || !member.character.system) return null
  return {
    ...member.character,
    dataJson: member.character.dataJson,
    system: member.character.system
  }
})

const roomMembers = computed(() => data.value?.room.members || [])
const sortedMembers = computed(() => [...roomMembers.value].sort((left, right) => {
  const leftOnline = isOnline(left) ? 0 : 1
  const rightOnline = isOnline(right) ? 0 : 1
  return leftOnline - rightOnline
}))

function isOnline(member: { user?: { id: string } | null }) {
  return Boolean(member.user?.id && onlineUserIds.value.has(member.user.id))
}

function isDead(member: { character?: { dataJson?: Record<string, unknown> | null } | null }) {
  const value = member.character?.dataJson?.[primaryResource.value]
  return typeof value === 'number' && value <= 0
}

async function reloadTable() {
  await refresh()
  await chat.value?.load()
}

async function loadPresence() {
  if (leavingRoom) return
  if (!data.value?.room.id) return
  try {
    const response = await $fetch<{ online: Array<{ userId: string }> }>(`/api/rooms/${data.value.room.id}/presence`)
    onlineUserIds.value = new Set(response.online.map((item) => item.userId))
  } catch {
    // Presence is a soft UI feature; the room can continue without it.
  }
}

async function setPresence(online: boolean, refreshChat = true) {
  if (!data.value?.room.id) return
  try {
    await $fetch(`/api/rooms/${data.value.room.id}/presence`, {
      method: 'POST',
      body: { online }
    })
    if (leavingRoom) return
    await loadPresence()
    if (refreshChat) await chat.value?.load()
  } catch {
    // Ignore best-effort presence updates.
  }
}

function privateReceived(userId: string) {
  unreadByUserId[userId] = (unreadByUserId[userId] || 0) + 1
  push('Nova mensagem privada.', 'info')
}

function clearDm(userId: string) {
  unreadByUserId[userId] = 0
}

async function deleteRoom() {
  if (!data.value?.room) return

  deleting.value = true
  try {
    await $fetch(`/api/rooms/${data.value.room.id}`, { method: 'DELETE' })
    push('Sala apagada.', 'success')
    await navigateTo('/app/rooms')
  } catch (error) {
    apiError(error, 'Nao foi possivel apagar a sala.')
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  userAccent.value = auth.user?.profileColor || localStorage.getItem('central-rpg:accent') || '#ff8a13'
  setPresence(true)
  loadPresence()
  roomTimer = setInterval(refresh, 5000)
  presenceTimer = setInterval(() => {
    setPresence(true)
    loadPresence()
  }, 8000)
})

onBeforeUnmount(() => {
  leavingRoom = true
  if (roomTimer) clearInterval(roomTimer)
  if (presenceTimer) clearInterval(presenceTimer)
  void setPresence(false, false)
})
</script>

<template>
  <div v-if="data?.room" class="space-y-5">
    <AppCard>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span class="rounded-md border border-ember/25 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">{{ data.room.system.name }}</span>
          <h1 class="mt-3 page-title">{{ data.room.name }}</h1>
          <p class="mt-2 text-mist">{{ data.room.description }}</p>
          <p class="mt-2 text-sm text-mist">Codigo: <b class="text-white">{{ data.room.code }}</b></p>
        </div>
        <div v-if="isMaster" class="flex flex-wrap gap-2">
          <div class="rounded-lg border border-ember/25 bg-ember/10 px-3 py-2 text-sm font-bold text-ember">
            Mestre da mesa
          </div>
          <div class="relative">
            <button type="button" class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-mist hover:text-white" @click="settingsOpen = !settingsOpen">
              <Settings class="h-5 w-5" />
            </button>
            <div v-if="settingsOpen" class="absolute right-0 top-12 z-10 w-44 rounded-lg border border-white/10 bg-panel p-1 shadow-soft">
              <button type="button" class="block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-red-100 hover:bg-flare/15" @click="confirmDeleteOpen = true; settingsOpen = false">Apagar sala</button>
            </div>
          </div>
        </div>
      </div>
    </AppCard>

    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-black uppercase tracking-[0.12em] text-mist">Jogadores na sala</h2>
      </div>
      <div class="flex gap-3 overflow-x-auto pb-1">
      <div
        v-for="member in sortedMembers"
        :key="member.id"
        class="surface relative min-w-[285px] rounded-xl border-l-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-ember/45"
        :style="{ borderLeftColor: memberColor(member.user?.id) }"
        :class="{ 'opacity-55 grayscale': !isOnline(member), 'border-flare/70 bg-flare/10': isDead(member) }"
        @click="openDm(member)"
      >
        <div class="flex items-center gap-4 pr-8">
          <div class="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg font-black text-white" :style="{ backgroundColor: `${memberColor(member.user?.id)}33` }">
            <img v-if="member.character?.avatarUrl" :src="member.character.avatarUrl" class="h-full w-full object-cover" :alt="member.character.name">
            <span v-else>{{ (member.character?.name || member.user?.name || '?').slice(0, 1) }}</span>
            <span v-if="isDead(member)" class="absolute bottom-1 right-1 rounded bg-flare px-1.5 py-0.5 text-[10px] font-black text-white">0</span>
          </div>
          <div class="min-w-0">
            <p class="flex items-center gap-1 break-words font-black text-white"><Crown v-if="member.role === 'MASTER'" class="h-4 w-4 shrink-0 text-ember" />{{ member.character?.name || member.user?.name }}</p>
            <p v-if="canSeeMemberSheet(member) && !isDead(member)" class="text-sm text-mist">{{ primaryResource }}: {{ member.character?.dataJson?.[primaryResource] ?? '-' }}</p>
            <p v-else-if="isDead(member)" class="text-sm text-red-100">Fora de combate</p>
            <p v-else class="text-sm text-mist">{{ isOnline(member) ? 'Online' : 'Offline' }}</p>
            <p class="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-bold text-mist">
              <span class="h-2 w-2 rounded-full" :class="isOnline(member) ? 'bg-emerald-400' : 'bg-mist/50'" />
              <span>{{ isOnline(member) ? 'Online' : 'Offline' }}</span>
              <span v-if="member.user?.id && unreadByUserId[member.user.id]" class="grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1.5 text-[10px] text-black">{{ unreadByUserId[member.user.id] }}</span>
            </p>
          </div>
        </div>
        <button
          v-if="canOpenDm(member) || canViewSheet(member)"
          type="button"
          class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-mist hover:bg-white/10 hover:text-white"
          title="Opcoes do jogador"
          @click.stop="memberMenuId = memberMenuId === member.id ? null : member.id"
        >
          <MoreHorizontal class="h-5 w-5" />
        </button>
        <div v-if="memberMenuId === member.id" class="absolute right-3 top-12 z-20 w-44 rounded-lg border border-white/10 bg-panel p-1 shadow-soft" @click.stop>
          <button v-if="canOpenDm(member)" type="button" class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-white hover:bg-white/10" @click="openDm(member)">
            <MessageCircle class="h-4 w-4 text-ember" />
            Mensagem
          </button>
          <button v-if="canViewSheet(member)" type="button" class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-white hover:bg-white/10" @click="openSheet(member)">
            <Eye class="h-4 w-4 text-ember" />
            Ver ficha
          </button>
        </div>
      </div>
      </div>
    </section>

    <section class="grid items-start gap-5 xl:grid-cols-[1fr_320px]">
      <div class="min-h-0">
        <ChatPanel
          ref="chat"
          :room-id="data.room.id"
          :character-id="myCharacter?.id"
          :members="data.room.members"
          :current-user-id="auth.user?.id"
          :is-master="isMaster"
          :dm-user-id="selectedDmUserId"
          :unread-by-user-id="unreadByUserId"
          @private-received="privateReceived"
          @clear-dm="clearDm"
          @close-dm="closeDm"
        />
      </div>
      <div class="grid gap-5">
        <DiceRoller :room-id="data.room.id" :character-id="myCharacter?.id" :is-master="isMaster" @rolled="chat?.load()" />
        <InitiativePanel
          :room-id="data.room.id"
          :members="data.room.members"
          :is-master="isMaster"
          :current-user-id="auth.user?.id"
          :current-character-id="myCharacter?.id"
          :primary-resource="primaryResource"
          :fields="data.room.system.fields"
          @event-created="reloadTable"
        />
      </div>
    </section>
    <RoomNotes :room-id="data.room.id" :user-id="auth.user?.id" :is-master="isMaster" />
    <CharacterSheet
      v-if="myCharacter?.dataJson && myCharacter.system"
      :character="{ ...myCharacter, dataJson: myCharacter.dataJson, system: myCharacter.system }"
      :room-id="data.room.id"
      editable
      @saved="refresh"
    />
    <ConfirmModal
      :open="confirmDeleteOpen"
      title="Apagar sala"
      :message="`Tem certeza que deseja apagar ${data.room.name}? Quem estiver dentro sera levado para o inicio.`"
      confirm-label="Apagar"
      :loading="deleting"
      @close="confirmDeleteOpen = false"
      @confirm="deleteRoom"
    />
    <Teleport to="body">
      <div v-if="viewingCharacter" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
        <div class="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-white/10 bg-panel p-5 shadow-soft">
          <div class="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-black text-white">Ficha do jogador</h2>
              <p class="text-sm text-mist">{{ primaryResource }} atual: {{ viewingCharacter.dataJson[primaryResource] ?? '-' }}</p>
            </div>
            <button type="button" class="rounded-lg p-2 text-mist hover:bg-white/10 hover:text-white" @click="viewingMemberId = null">
              <X class="h-5 w-5" />
            </button>
          </div>
          <CharacterSheet :character="viewingCharacter" :room-id="data.room.id" />
        </div>
      </div>
    </Teleport>
  </div>
</template>
