<script setup lang="ts">
import { Crown, Eye, LogOut, MessageCircle, MoreHorizontal, Play, Radio, Search, Settings, Square, UserPlus, Users, X } from 'lucide-vue-next'
import type { SystemSchema } from '../../../../shared/types/system'
import { characterFormulaVariableList, formulaVariableList } from '~~/shared/utils/characterRules'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const chat = ref<{ load: () => Promise<void> } | null>(null)
const { push, apiError } = useToast()
const deleting = ref(false)
const sessionLoading = ref(false)
const settingsOpen = ref(false)
const confirmDeleteOpen = ref(false)
const { data, refresh, error } = await useFetch<{ room: {
  id: string
  name: string
  description?: string | null
  code: string
  masterId: string
  mapJson?: { columns: number; rows: number; tokens: Array<{ id: string; name: string; avatarUrl?: string | null; color?: string | null; kind: 'CHARACTER' | 'NPC' | 'MARKER'; x: number; y: number; previousX?: number | null; previousY?: number | null }> } | null
  system: {
    id: string
    name: string
    schemaJson?: { primaryResource?: string }
    fields: Array<{ key: string; label: string; type: string; category: string }>
  }
  sessions: Array<{ id: string; status: string }>
  npcs?: Array<{ id: string; name: string; avatarUrl?: string | null; description?: string | null }>
  members: Array<{ id: string; role: string; user?: { id: string; name: string; profileColor?: string | null }; character?: {
    id: string
    name: string
    description?: string | null
    avatarUrl?: string | null
    dataJson?: Record<string, unknown> | null
    system?: { name: string; schemaJson?: SystemSchema; fields: Array<{ id?: string; key: string; label: string; type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'LIST' | 'FORMULA' | 'DICE'; category: 'ATTRIBUTE' | 'SKILL' | 'RESOURCE' | 'STATUS_BAR' | 'TEXT_FIELD' | 'NUMERIC_FIELD' | 'BOOLEAN_FIELD' | 'LIST_FIELD' | 'FORMULA' | 'ROLL_RULE'; defaultValue?: unknown; optionsJson?: unknown; formula?: string | null }> }
  } | null }>
} }>(`/api/rooms/${route.params.id}`)
const { data: myCharacters } = await useFetch<{ characters: Array<{ id: string; name: string; systemId: string; system?: { id: string; name: string; schemaJson?: SystemSchema } }> }>('/api/characters', { default: () => ({ characters: [] }) })
const { data: friendsData } = await useFetch<{ friends: Array<{ id: string; name: string; username?: string | null; avatarUrl?: string | null; profileColor?: string | null }> }>('/api/social/friends', { default: () => ({ friends: [] }) })

watch(error, async (next) => {
  if (!next) return
  push('Esta sala nao existe mais.', 'info')
  await navigateTo('/app')
})

const isMaster = computed(() => data.value?.room.masterId === auth.user?.id)
const myCharacter = computed(() => data.value?.room.members.find((member) => member.user?.id === auth.user?.id)?.character)
const primaryResource = computed(() => data.value?.room.system.schemaJson?.primaryResource || 'vida')
const activeSession = computed(() => data.value?.room.sessions.find((session) => session.status === 'ACTIVE') || null)
const sessionLabel = computed(() => {
  if (activeSession.value) return 'Sessao ativa'
  if (data.value?.room.members.length) return 'Aguardando inicio'
  return 'Aguardando jogadores'
})
const selectedDmUserId = ref<string | null>(null)
const memberMenuId = ref<string | null>(null)
const viewingMemberId = ref<string | null>(null)
const unreadByUserId = reactive<Record<string, number>>({})
const onlineUserIds = ref(new Set<string>())
const userAccent = ref('#ff8a13')
const settingsSaving = ref(false)
const selectedCharacterId = ref('')
const inviteOpen = ref(false)
const inviteSearch = ref('')
const selectedInviteIds = ref(new Set<string>())
const inviting = ref(false)
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
const compatibleCharacters = computed(() => (myCharacters.value?.characters || []).filter((character) => {
  const roomSystemId = data.value?.room.system.id
  if (!roomSystemId) return false
  return character.systemId === roomSystemId || (character.system as any)?.schemaJson?.provenance?.sourceSystemId === roomSystemId
}))
const availableFriends = computed(() => {
  const term = inviteSearch.value.trim().toLowerCase()
  const memberIds = new Set((data.value?.room.members || []).map((member) => member.user?.id).filter(Boolean))
  return (friendsData.value?.friends || [])
    .filter((friend) => !memberIds.has(friend.id))
    .filter((friend) => !term || `${friend.name} ${friend.username || ''}`.toLowerCase().includes(term))
})
const rollVariables = computed(() => {
  if (!myCharacter.value?.system || !myCharacter.value.dataJson) {
    const system = data.value?.room.system
    return isMaster.value ? formulaVariableList(system?.schemaJson as SystemSchema | undefined, system?.fields as never[] || []) : []
  }
  return characterFormulaVariableList(
    myCharacter.value.system.schemaJson as SystemSchema | undefined,
    myCharacter.value.system.fields as never[] || [],
    myCharacter.value.dataJson as Record<string, unknown>
  )
})

watch(myCharacter, (next) => {
  selectedCharacterId.value = next?.id || ''
}, { immediate: true })

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

async function setPresence(online: boolean, refreshChat = false) {
  if (!data.value?.room.id) return
  try {
    await $fetch(`/api/rooms/${data.value.room.id}/presence`, {
      method: 'POST',
      body: { online }
    })
    if (leavingRoom) return
    if (online && auth.user?.id) {
      const next = new Set(onlineUserIds.value)
      next.add(auth.user.id)
      onlineUserIds.value = next
    }
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

async function startSession() {
  if (!data.value?.room.id) return
  sessionLoading.value = true
  try {
    await $fetch(`/api/rooms/${data.value.room.id}/session/start`, { method: 'POST' })
    push('Sessao iniciada.', 'success')
    await reloadTable()
  } catch (error) {
    apiError(error, 'Nao foi possivel iniciar a sessao.')
  } finally {
    sessionLoading.value = false
  }
}

async function endSession() {
  if (!data.value?.room.id) return
  sessionLoading.value = true
  try {
    await $fetch(`/api/rooms/${data.value.room.id}/session/end`, { method: 'POST' })
    push('Sessao encerrada.', 'success')
    await reloadTable()
  } catch (error) {
    apiError(error, 'Nao foi possivel encerrar a sessao.')
  } finally {
    sessionLoading.value = false
  }
}

async function changeCharacter() {
  if (!data.value?.room.id || !selectedCharacterId.value) return
  settingsSaving.value = true
  try {
    await $fetch(`/api/rooms/${data.value.room.id}/character`, {
      method: 'PUT',
      body: { characterId: selectedCharacterId.value }
    })
    push('Personagem da sessao atualizado.', 'success')
    await reloadTable()
  } catch (error) {
    apiError(error, 'Nao foi possivel trocar o personagem.')
  } finally {
    settingsSaving.value = false
  }
}

function toggleInviteSelection(id: string) {
  const next = new Set(selectedInviteIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedInviteIds.value = next
}

async function sendInvites() {
  if (!data.value?.room.id || selectedInviteIds.value.size === 0) return
  inviting.value = true
  try {
    const response = await $fetch<{ invited: number }>(`/api/rooms/${data.value.room.id}/invites`, {
      method: 'POST',
      body: { userIds: [...selectedInviteIds.value] }
    })
    selectedInviteIds.value = new Set()
    inviteOpen.value = false
    push(`${response.invited} convite(s) enviado(s).`, 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel enviar convites.')
  } finally {
    inviting.value = false
  }
}

onMounted(() => {
  userAccent.value = auth.user?.profileColor || localStorage.getItem('central-rpg:accent') || '#ff8a13'
  if (route.query.settings === '1') {
    settingsOpen.value = true
    const nextQuery = { ...route.query }
    delete nextQuery.settings
    void router.replace({ query: nextQuery })
  }
  setPresence(true, true)
  loadPresence()
  roomTimer = setInterval(refresh, 5000)
  presenceTimer = setInterval(() => {
    setPresence(true)
  }, 15000)
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
    <section class="surface rounded-lg p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="kbd-chip">{{ data.room.system.name }}</span>
            <span class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-bold" :class="activeSession ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/[0.04] text-mist'">
              <Radio class="h-3.5 w-3.5" />
              {{ sessionLabel }}
            </span>
            <span class="kbd-chip">Codigo {{ data.room.code }}</span>
          </div>
          <h1 class="mt-3 page-title">{{ data.room.name }}</h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-mist">{{ data.room.description || 'Sala pronta para narrativa, rolagens, fichas e historico da mesa.' }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <AppButton v-if="isMaster && !activeSession" :loading="sessionLoading" @click="startSession"><Play class="h-4 w-4" />Iniciar sessao</AppButton>
          <AppButton v-if="isMaster && activeSession" variant="ghost" :loading="sessionLoading" @click="endSession"><Square class="h-4 w-4" />Encerrar</AppButton>
          <AppButton variant="ghost" @click="inviteOpen = true"><UserPlus class="h-4 w-4" />Convidar amigo</AppButton>
          <div>
            <button type="button" class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-mist hover:text-white" @click="settingsOpen = true">
              <Settings class="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <TacticalMap
      :room-id="data.room.id"
      :model-value="data.room.mapJson"
      :members="data.room.members"
      :npcs="data.room.npcs || []"
      :current-user-id="auth.user?.id"
      :is-master="isMaster"
      @saved="reloadTable"
    />

    <section class="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
      <aside class="space-y-4 xl:sticky xl:top-24">
        <AppCard>
          <div class="flex items-center justify-between gap-3">
            <h2 class="flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-mist">
              <Users class="h-4 w-4 text-ember" /> Jogadores
            </h2>
            <span class="text-xs font-bold text-mist">{{ onlineUserIds.size }}/{{ sortedMembers.length }}</span>
          </div>
          <div class="mt-4 space-y-2">
            <div
              v-for="member in sortedMembers"
              :key="member.id"
              class="relative rounded-lg border border-white/10 bg-white/[0.035] p-3 transition hover:bg-white/[0.06]"
              :class="{ 'opacity-55': !isOnline(member), 'border-flare/50 bg-flare/10': isDead(member) }"
            >
              <button type="button" class="flex w-full items-center gap-3 text-left" @click="openDm(member)">
                <AppAvatar :name="member.character?.name || member.user?.name" :src="member.character?.avatarUrl" :color="memberColor(member.user?.id)" />
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1 truncate font-black text-white">
                    <Crown v-if="member.role === 'MASTER'" class="h-3.5 w-3.5 shrink-0 text-ember" />
                    {{ member.character?.name || member.user?.name }}
                  </span>
                  <span class="mt-0.5 flex items-center gap-2 text-xs text-mist">
                    <span class="h-2 w-2 rounded-full" :class="isOnline(member) ? 'bg-emerald-400' : 'bg-mist/50'" />
                    {{ isDead(member) ? 'Fora de combate' : isOnline(member) ? 'Online' : 'Offline' }}
                  </span>
                </span>
                <span v-if="canSeeMemberSheet(member) && !isDead(member)" class="text-xs font-bold text-mist">{{ member.character?.dataJson?.[primaryResource] ?? '-' }}</span>
              </button>

              <button
                v-if="canOpenDm(member) || canViewSheet(member)"
                type="button"
                class="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-mist hover:bg-white/10 hover:text-white"
                title="Opcoes"
                @click.stop="memberMenuId = memberMenuId === member.id ? null : member.id"
              >
                <MoreHorizontal class="h-4 w-4" />
              </button>
              <div v-if="memberMenuId === member.id" class="absolute right-2 top-10 z-20 w-44 rounded-lg border border-white/10 bg-panel p-1 shadow-soft" @click.stop>
                <button v-if="canOpenDm(member)" type="button" class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-white hover:bg-white/10" @click="openDm(member)">
                  <MessageCircle class="h-4 w-4 text-ember" /> Mensagem
                </button>
                <button v-if="canViewSheet(member)" type="button" class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-white hover:bg-white/10" @click="openSheet(member)">
                  <Eye class="h-4 w-4 text-ember" /> Ver ficha
                </button>
              </div>
            </div>
          </div>
        </AppCard>
      </aside>

      <main class="min-w-0 space-y-5">
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
        <CharacterSheet
          v-if="myCharacter?.dataJson && myCharacter.system"
          :character="{ ...myCharacter, dataJson: myCharacter.dataJson, system: myCharacter.system }"
          :room-id="data.room.id"
          editable
          @saved="refresh"
        />
      </main>

      <aside class="grid gap-5 xl:sticky xl:top-24">
        <DiceRoller :room-id="data.room.id" :character-id="myCharacter?.id" :is-master="isMaster" :variables="rollVariables" @rolled="chat?.load()" />
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
        <RoomNotes :room-id="data.room.id" :user-id="auth.user?.id" :is-master="isMaster" />
      </aside>
    </section>

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
      <div v-if="inviteOpen" class="fixed inset-0 z-50 grid place-items-end bg-black/60 p-0 sm:place-items-center sm:p-4" @click.self="inviteOpen = false">
        <div class="max-h-[92vh] w-full overflow-y-auto border border-white/10 bg-panel p-5 shadow-soft sm:max-w-lg sm:rounded-lg">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-xl font-black text-white">Convidar amigos</h2>
              <p class="mt-1 text-sm text-mist">{{ data.room.name }}</p>
            </div>
            <button type="button" class="rounded-lg p-2 text-mist hover:bg-white/10 hover:text-white" @click="inviteOpen = false"><X class="h-5 w-5" /></button>
          </div>
          <label class="relative mt-4 block">
            <Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-mist" />
            <input v-model="inviteSearch" class="input pl-9" placeholder="Buscar amigos">
          </label>
          <div class="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
            <label v-for="friend in availableFriends" :key="friend.id" class="soft-row flex cursor-pointer items-center gap-3 p-3">
              <input type="checkbox" class="h-4 w-4 accent-ember" :checked="selectedInviteIds.has(friend.id)" @change="toggleInviteSelection(friend.id)">
              <AppAvatar :name="friend.name" :src="friend.avatarUrl" :color="friend.profileColor" rounded="full" />
              <span class="min-w-0">
                <b class="block truncate text-white">{{ friend.name }}</b>
                <span class="block truncate text-xs text-mist">{{ friend.username ? `@${friend.username}` : 'sem usuario publico' }}</span>
              </span>
            </label>
            <EmptyState v-if="!availableFriends.length" title="Nenhum amigo disponivel" description="Amigos que ja estao na sessao ou nao correspondem a busca nao aparecem aqui." />
          </div>
          <div class="mt-5 flex flex-wrap justify-end gap-2">
            <AppButton variant="ghost" @click="inviteOpen = false">Cancelar</AppButton>
            <AppButton :loading="inviting" :disabled="selectedInviteIds.size === 0" @click="sendInvites">Enviar convite</AppButton>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="settingsOpen" class="fixed inset-0 z-40 grid place-items-end bg-black/60 p-0 sm:place-items-center sm:p-4" @click.self="settingsOpen = false">
        <div class="max-h-[92vh] w-full overflow-y-auto border border-white/10 bg-panel p-5 shadow-soft sm:max-w-lg sm:rounded-lg">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-xl font-black text-white">Configuracoes da sessao</h2>
              <p class="mt-1 text-sm text-mist">{{ data.room.name }} · Codigo {{ data.room.code }}</p>
            </div>
            <button type="button" class="rounded-lg p-2 text-mist hover:bg-white/10 hover:text-white" @click="settingsOpen = false">
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="mt-5 space-y-4">
            <AppCard>
              <h3 class="font-black text-white">Personagem nesta sessao</h3>
              <p class="mt-1 text-sm text-mist">Escolha um personagem compativel com {{ data.room.system.name }}.</p>
              <div class="mt-3 flex flex-col gap-2 sm:flex-row">
                <select v-model="selectedCharacterId" class="select" :disabled="compatibleCharacters.length === 0">
                  <option v-if="compatibleCharacters.length === 0" value="">Nenhum personagem compativel</option>
                  <option v-for="character in compatibleCharacters" :key="character.id" :value="character.id">{{ character.name }}</option>
                </select>
                <AppButton :loading="settingsSaving" :disabled="!selectedCharacterId || selectedCharacterId === myCharacter?.id" @click="changeCharacter">Trocar</AppButton>
              </div>
            </AppCard>

            <AppCard>
              <h3 class="font-black text-white">Dados da sala</h3>
              <dl class="mt-3 grid gap-3 text-sm text-mist sm:grid-cols-2">
                <div><dt class="label">Sistema</dt><dd class="text-white">{{ data.room.system.name }}</dd></div>
                <div><dt class="label">Status</dt><dd class="text-white">{{ sessionLabel }}</dd></div>
                <div><dt class="label">Jogadores</dt><dd class="text-white">{{ sortedMembers.length }}</dd></div>
                <div><dt class="label">Codigo</dt><dd class="text-white">{{ data.room.code }}</dd></div>
              </dl>
            </AppCard>

            <AppCard v-if="isMaster">
              <h3 class="font-black text-white">Opcoes do mestre</h3>
              <div class="mt-3 flex flex-wrap gap-2">
                <AppButton v-if="!activeSession" :loading="sessionLoading" @click="startSession">Iniciar sessao</AppButton>
                <AppButton v-else variant="ghost" :loading="sessionLoading" @click="endSession">Encerrar sessao</AppButton>
                <AppButton variant="danger" @click="confirmDeleteOpen = true">Apagar sala</AppButton>
              </div>
            </AppCard>

            <AppCard>
              <h3 class="font-black text-white">Acoes</h3>
              <NuxtLink to="/app/rooms" class="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-bold text-mist hover:text-white">
                <LogOut class="h-4 w-4" /> Sair da mesa
              </NuxtLink>
            </AppCard>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="viewingCharacter" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
        <div class="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-white/10 bg-panel p-5 shadow-soft">
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

