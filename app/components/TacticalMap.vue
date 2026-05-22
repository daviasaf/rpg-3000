<script setup lang="ts">
import { Bot, ChevronDown, Plus, RotateCcw, Save, Settings, Trash2, Users, X } from 'lucide-vue-next'

type MapToken = {
  id: string
  name: string
  avatarUrl?: string | null
  color?: string | null
  kind: 'CHARACTER' | 'NPC' | 'MARKER'
  x: number
  y: number
  previousX?: number | null
  previousY?: number | null
}

type TacticalMapState = {
  columns: number
  rows: number
  tokens: MapToken[]
}

const SYSTEM_TOKEN_COLOR = '#ff8a13'

const props = defineProps<{
  roomId: string
  modelValue?: TacticalMapState | null
  members: Array<{ user?: { id?: string | null; name?: string | null; profileColor?: string | null } | null; character?: { id: string; name: string; avatarUrl?: string | null } | null }>
  npcs?: Array<{ id: string; name: string; avatarUrl?: string | null; description?: string | null }>
  currentUserId?: string | null
  isMaster?: boolean
}>()

const emit = defineEmits<{ saved: [map: TacticalMapState] }>()
const { push, apiError } = useToast()
const saving = ref(false)
const selectedId = ref<string | null>(null)
const expanded = ref(false)
const configOpen = ref(false)
const map = reactive<TacticalMapState>(normaliseMap(props.modelValue, props.members))

watch(() => props.modelValue, (next) => {
  Object.assign(map, normaliseMap(next, props.members))
}, { deep: true })

function normaliseMap(value?: TacticalMapState | null, members = props.members): TacticalMapState {
  const memberColors = new Map(
    members
      .filter((member) => member.character?.id)
      .map((member) => [member.character!.id, member.user?.profileColor || '#ff8a13'])
  )

  if (value?.columns && value.rows && Array.isArray(value.tokens)) {
    return {
      columns: value.columns,
      rows: value.rows,
      tokens: value.tokens.map((token) => ({
        ...token,
        color: token.kind === 'CHARACTER'
          ? memberColors.get(token.id) || token.color || SYSTEM_TOKEN_COLOR
          : token.kind === 'NPC'
            ? SYSTEM_TOKEN_COLOR
            : token.color || SYSTEM_TOKEN_COLOR
      }))
    }
  }

  return {
    columns: 14,
    rows: 10,
    tokens: members
      .filter((member) => member.character)
      .slice(0, 20)
      .map((member, index) => ({
        id: member.character!.id,
        name: member.character!.name,
        avatarUrl: member.character!.avatarUrl,
        color: member.user?.profileColor || SYSTEM_TOKEN_COLOR,
        kind: 'CHARACTER' as const,
        x: index % 7,
        y: Math.floor(index / 7)
      }))
  }
}

function alphaColor(color?: string | null, alpha = 0.16) {
  const fallback = SYSTEM_TOKEN_COLOR
  const value = color || fallback
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    const red = Number.parseInt(value.slice(1, 3), 16)
    const green = Number.parseInt(value.slice(3, 5), 16)
    const blue = Number.parseInt(value.slice(5, 7), 16)
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`
  }
  return value
}

function trailStyle(token: MapToken) {
  return {
    borderColor: alphaColor(token.color, 0.36),
    backgroundColor: alphaColor(token.color, 0.14),
    boxShadow: `0 0 18px ${alphaColor(token.color, 0.12)}`
  }
}

function tokenAt(x: number, y: number) {
  return map.tokens.find((token) => token.x === x && token.y === y)
}

function previousTokensAt(x: number, y: number) {
  return map.tokens.filter((token) => token.previousX === x && token.previousY === y && (token.x !== x || token.y !== y))
}

const activeTokenIds = computed(() => new Set(map.tokens.map((token) => token.id)))
const availableCharacters = computed(() => props.members
  .filter((member) => member.character?.id)
  .filter((member) => !activeTokenIds.value.has(member.character!.id)))
const availableNpcs = computed(() => (props.npcs || []).filter((npc) => !activeTokenIds.value.has(`npc:${npc.id}`)))

function canMoveToken(token?: MapToken) {
  if (!token) return false
  if (props.isMaster) return true
  return props.members.some((member) => member.user?.id === props.currentUserId && member.character?.id === token.id)
}

function selectToken(token?: MapToken) {
  if (!token || !canMoveToken(token)) return
  selectedId.value = selectedId.value === token.id ? null : token.id
}

async function cellClick(x: number, y: number) {
  const target = tokenAt(x, y)

  if (target) {
    selectToken(target)
    return
  }

  if (!selectedId.value) return
  const token = map.tokens.find((item) => item.id === selectedId.value)
  if (!token || !canMoveToken(token)) return
  if (token.x === x && token.y === y) return

  token.previousX = token.x
  token.previousY = token.y
  token.x = x
  token.y = y
  await save(true, token)
}

async function save(silent = false, movedToken?: MapToken) {
  saving.value = true
  try {
    const response = await $fetch<{ map: TacticalMapState }>(`/api/rooms/${props.roomId}/map`, {
      method: 'PUT',
      body: { ...map, movedTokenId: movedToken?.id }
    })
    emit('saved', response.map)
    if (!silent) push('Mapa salvo.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel salvar o mapa.')
  } finally {
    saving.value = false
  }
}

async function resetPositions() {
  if (!props.isMaster) return
  map.tokens.forEach((token, index) => {
    token.previousX = token.x
    token.previousY = token.y
    token.x = index % Math.min(7, map.columns)
    token.y = Math.floor(index / Math.min(7, map.columns))
  })
  selectedId.value = null
  await save()
}

function firstFreeCell() {
  for (let y = 0; y < map.rows; y += 1) {
    for (let x = 0; x < map.columns; x += 1) {
      if (!tokenAt(x, y)) return { x, y }
    }
  }
  return null
}

async function addCharacterToken(member: NonNullable<typeof props.members[number]>) {
  if (!props.isMaster || !member.character) return
  if (activeTokenIds.value.has(member.character.id)) return

  const cell = firstFreeCell()
  if (!cell) {
    push('O mapa esta cheio.', 'error')
    return
  }

  const token: MapToken = {
    id: member.character.id,
    name: member.character.name,
    avatarUrl: member.character.avatarUrl,
    color: member.user?.profileColor || SYSTEM_TOKEN_COLOR,
    kind: 'CHARACTER',
    x: cell.x,
    y: cell.y,
    previousX: null,
    previousY: null
  }

  map.tokens.push(token)
  selectedId.value = token.id
  await save(true)
  push(`${token.name} entrou no mapa.`, 'success')
}

async function addNpcToken(npc: NonNullable<typeof props.npcs>[number]) {
  if (!props.isMaster) return
  if (activeTokenIds.value.has(`npc:${npc.id}`)) return

  const cell = firstFreeCell()
  if (!cell) {
    push('O mapa esta cheio.', 'error')
    return
  }

  const token: MapToken = {
    id: `npc:${npc.id}`,
    name: npc.name,
    avatarUrl: npc.avatarUrl,
    color: SYSTEM_TOKEN_COLOR,
    kind: 'NPC',
    x: cell.x,
    y: cell.y,
    previousX: null,
    previousY: null
  }
  map.tokens.push(token)
  selectedId.value = token.id
  await save(true)
  push(`${token.name} entrou no mapa.`, 'success')
}

async function removeToken(token: MapToken) {
  if (!props.isMaster) return
  map.tokens = map.tokens.filter((item) => item.id !== token.id)
  if (selectedId.value === token.id) selectedId.value = null
  await save(true)
  push(`${token.name} saiu do mapa.`, 'success')
}
</script>

<template>
  <AppCard class="overflow-hidden p-0">
    <button type="button" class="flex w-full flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 text-left" @click="expanded = !expanded">
      <div>
        <h2 class="text-lg font-black text-white">Mapa tatico</h2>
        <p class="text-sm text-mist">{{ expanded ? (isMaster ? 'Modo mestre: selecione um token e clique em uma celula para mover.' : 'Selecione seu token para mover quando permitido.') : `${map.tokens.length} tokens no mapa` }}</p>
      </div>
      <div class="flex items-center gap-2">
        <ChevronDown class="h-5 w-5 text-ember transition" :class="expanded ? 'rotate-180' : ''" />
      </div>
    </button>

    <div v-if="expanded" class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
      <div v-if="isMaster" class="flex items-center gap-2">
        <AppButton variant="ghost" type="button" @click="configOpen = true"><Settings class="h-4 w-4" />Configurar mapa</AppButton>
        <AppButton variant="ghost" :loading="saving" @click="resetPositions"><RotateCcw class="h-4 w-4" />Reorganizar</AppButton>
        <AppButton :loading="saving" @click="save()"><Save class="h-4 w-4" />Salvar</AppButton>
      </div>
    </div>

    <div v-if="expanded" class="max-h-[430px] overflow-auto bg-[#10131f] p-4">
      <div
        class="mx-auto grid w-max gap-2 rounded-lg border border-white/10 bg-[#0c0f19] p-3 shadow-inner"
        :style="{ gridTemplateColumns: `repeat(${map.columns}, minmax(44px, 52px))` }"
      >
        <button
          v-for="cell in map.columns * map.rows"
          :key="cell"
          type="button"
          class="relative grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-white/[0.035] transition"
          :class="[
            'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:14px_14px]',
            selectedId ? 'hover:border-ember/50 hover:bg-ember/10' : '',
            tokenAt((cell - 1) % map.columns, Math.floor((cell - 1) / map.columns))?.id === selectedId ? 'border-ember bg-ember/15' : ''
          ]"
          @click="cellClick((cell - 1) % map.columns, Math.floor((cell - 1) / map.columns))"
        >
          <span
            v-for="trail in previousTokensAt((cell - 1) % map.columns, Math.floor((cell - 1) / map.columns))"
            :key="trail.id"
            class="absolute inset-1 rounded-md border"
            :style="trailStyle(trail)"
          />
          <AppAvatar
            v-if="tokenAt((cell - 1) % map.columns, Math.floor((cell - 1) / map.columns))"
            :name="tokenAt((cell - 1) % map.columns, Math.floor((cell - 1) / map.columns))?.name"
            :src="tokenAt((cell - 1) % map.columns, Math.floor((cell - 1) / map.columns))?.avatarUrl"
            :color="tokenAt((cell - 1) % map.columns, Math.floor((cell - 1) / map.columns))?.color || SYSTEM_TOKEN_COLOR"
            size="sm"
          />
        </button>
      </div>
    </div>
  </AppCard>

  <Teleport to="body">
    <div v-if="configOpen" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div class="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/10 bg-panel shadow-soft">
        <div class="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2 class="text-xl font-black text-white">Configuracao do mapa</h2>
            <p class="mt-1 text-sm text-mist">Adicione jogadores da sala e NPCs do seu inventario, ou remova tokens da cena.</p>
          </div>
          <button type="button" class="rounded-lg p-2 text-mist hover:bg-white/10 hover:text-white" @click="configOpen = false">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="grid gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
          <section class="space-y-4">
            <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div class="flex items-center gap-2">
                <Users class="h-4 w-4 text-ember" />
                <h3 class="font-black text-white">Colocar jogadores</h3>
              </div>
              <div class="mt-3 space-y-2">
                <div v-if="!availableCharacters.length" class="rounded-lg border border-white/10 bg-black/10 px-3 py-4 text-sm text-mist">
                  Todos os jogadores com personagem ja estao no mapa.
                </div>
                <div
                  v-for="member in availableCharacters"
                  :key="member.character!.id"
                  class="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 p-3"
                >
                  <div class="flex min-w-0 items-center gap-3">
                    <AppAvatar :name="member.character?.name" :src="member.character?.avatarUrl" :color="member.user?.profileColor || SYSTEM_TOKEN_COLOR" size="sm" />
                    <div class="min-w-0">
                      <p class="truncate font-black text-white">{{ member.character?.name }}</p>
                      <p class="truncate text-xs text-mist">{{ member.user?.name || 'Jogador' }}</p>
                    </div>
                  </div>
                  <AppButton variant="ghost" type="button" :loading="saving" @click="addCharacterToken(member)"><Plus class="h-4 w-4" />Colocar</AppButton>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div class="flex items-center gap-2">
                <Bot class="h-4 w-4 text-ember" />
                <h3 class="font-black text-white">Colocar NPCs do inventario</h3>
              </div>
              <div class="mt-3 space-y-2">
                <div v-if="!availableNpcs.length" class="rounded-lg border border-white/10 bg-black/10 px-3 py-4 text-sm text-mist">
                  Todos os NPCs disponiveis ja estao no mapa.
                </div>
                <div
                  v-for="npc in availableNpcs"
                  :key="npc.id"
                  class="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 p-3"
                >
                  <div class="flex min-w-0 items-center gap-3">
                    <AppAvatar :name="npc.name" :src="npc.avatarUrl" :color="SYSTEM_TOKEN_COLOR" size="sm" />
                    <div class="min-w-0">
                      <p class="truncate font-black text-white">{{ npc.name }}</p>
                      <p class="line-clamp-1 text-xs text-mist">{{ npc.description || 'NPC do inventario' }}</p>
                    </div>
                  </div>
                  <AppButton variant="ghost" type="button" :loading="saving" @click="addNpcToken(npc)"><Plus class="h-4 w-4" />Colocar</AppButton>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 class="font-black text-white">Remover do mapa</h3>
            <div class="mt-3 space-y-2">
              <div v-if="!map.tokens.length" class="rounded-lg border border-white/10 bg-black/10 px-3 py-4 text-sm text-mist">
                Nenhum token no mapa.
              </div>
              <div
                v-for="token in map.tokens"
                :key="token.id"
                class="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 p-3"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <AppAvatar :name="token.name" :src="token.avatarUrl" :color="token.color || SYSTEM_TOKEN_COLOR" size="sm" />
                  <div class="min-w-0">
                    <p class="truncate font-black text-white">{{ token.name }}</p>
                    <p class="text-xs text-mist">{{ token.kind === 'NPC' ? 'NPC' : token.kind === 'CHARACTER' ? 'Jogador' : 'Marcador' }}</p>
                  </div>
                </div>
                <button type="button" class="rounded-lg p-2 text-red-300 hover:bg-red-500/10 hover:text-red-100" :disabled="saving" @click="removeToken(token)">
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

