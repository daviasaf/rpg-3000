<script setup lang="ts">
import { ChevronDown, RotateCcw, Save } from 'lucide-vue-next'

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

const props = defineProps<{
  roomId: string
  modelValue?: TacticalMapState | null
  members: Array<{ user?: { id?: string | null; name?: string | null; profileColor?: string | null } | null; character?: { id: string; name: string; avatarUrl?: string | null } | null }>
  currentUserId?: string | null
  isMaster?: boolean
}>()

const emit = defineEmits<{ saved: [map: TacticalMapState] }>()
const { push, apiError } = useToast()
const saving = ref(false)
const selectedId = ref<string | null>(null)
const expanded = ref(false)
const map = reactive<TacticalMapState>(normaliseMap(props.modelValue, props.members))

watch(() => props.modelValue, (next) => {
  Object.assign(map, normaliseMap(next, props.members))
}, { deep: true })

function normaliseMap(value?: TacticalMapState | null, members = props.members): TacticalMapState {
  if (value?.columns && value.rows && Array.isArray(value.tokens)) {
    return {
      columns: value.columns,
      rows: value.rows,
      tokens: value.tokens
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
        color: member.user?.profileColor || '#ff8a13',
        kind: 'CHARACTER' as const,
        x: index % 7,
        y: Math.floor(index / 7)
      }))
  }
}

function tokenAt(x: number, y: number) {
  return map.tokens.find((token) => token.x === x && token.y === y)
}

function previousTokensAt(x: number, y: number) {
  return map.tokens.filter((token) => token.previousX === x && token.previousY === y && (token.x !== x || token.y !== y))
}

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

    <div v-if="expanded" class="flex flex-wrap items-center justify-end gap-2 border-b border-white/10 p-4">
      <div v-if="isMaster" class="flex items-center gap-2">
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
            class="absolute inset-1 rounded-md border border-ember/25 bg-ember/10"
          />
          <AppAvatar
            v-if="tokenAt((cell - 1) % map.columns, Math.floor((cell - 1) / map.columns))"
            :name="tokenAt((cell - 1) % map.columns, Math.floor((cell - 1) / map.columns))?.name"
            :src="tokenAt((cell - 1) % map.columns, Math.floor((cell - 1) / map.columns))?.avatarUrl"
            :color="tokenAt((cell - 1) % map.columns, Math.floor((cell - 1) / map.columns))?.color || '#ff8a13'"
            size="sm"
          />
        </button>
      </div>
    </div>
  </AppCard>
</template>
