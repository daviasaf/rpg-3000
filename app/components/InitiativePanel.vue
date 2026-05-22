<script setup lang="ts">
import { GripVertical, Plus, X } from 'lucide-vue-next'

type RoomMember = {
  id: string
  character?: { id: string; name: string; dataJson?: Record<string, unknown> | null } | null
  user?: { id: string; name: string } | null
}

const props = defineProps<{
  roomId: string
  members: RoomMember[]
  isMaster?: boolean
  currentUserId?: string | null
  currentCharacterId?: string | null
  primaryResource?: string
  fields?: Array<{ key: string; label: string; type: string; category: string }>
}>()

const emit = defineEmits<{ eventCreated: [] }>()
const { push, apiError } = useToast()
const open = ref(false)
const loading = ref(false)
const activeMemberId = ref('')
const orderIds = ref<string[]>([])
const draggingId = ref('')
const seenRequests = ref(new Set<string>())
const seenSheetUpdates = ref(new Set<string>())
const npcs = ref<Array<{ id: string; name: string; description?: string | null; dataJson?: Record<string, unknown> }>>([])
const sceneNpcs = ref<Array<{ id: string; name: string }>>([])
const removedActorIds = ref<string[]>([])
const eventContent = ref('')
const action = ref<'INSERT_NPC' | 'REMOVE_ACTOR' | 'ATTACK' | 'DAMAGE' | 'HEAL' | 'REWARD' | 'NOTE' | 'FIELD_CHANGE'>('DAMAGE')
const pendingSheetUpdate = ref<null | {
  requestId: string
  action: 'DAMAGE' | 'HEAL' | 'ATTACK'
  amount: number
  fieldKey: string
  fieldLabel: string
  content: string
}>(null)
const form = reactive({
  npcName: '',
  npcId: '',
  actorId: '',
  targetId: '',
  amount: 5,
  reward: '',
  note: '',
  fieldKey: '',
  fieldValue: ''
})

const actionOptions = [
  { value: 'INSERT_NPC', label: 'Inserir NPC' },
  { value: 'REMOVE_ACTOR', label: 'Remover da cena' },
  { value: 'ATTACK', label: 'Atacar' },
  { value: 'DAMAGE', label: 'Dano' },
  { value: 'HEAL', label: 'Cura' },
  { value: 'REWARD', label: 'Recompensa' },
  { value: 'NOTE', label: 'Aviso' }
] as const

const actors = computed(() => [
  ...props.members
    .map((member) => ({
      id: member.id,
      actorId: member.character?.id || member.user?.id || member.id,
      name: member.character?.name || member.user?.name || 'Sem nome'
    }))
    .filter((actor) => !removedActorIds.value.includes(actor.id) && !removedActorIds.value.includes(actor.actorId)),
  ...sceneNpcs.value
    .map((npc) => ({
      id: npc.id,
      actorId: npc.id,
      name: npc.name
    }))
    .filter((actor) => !removedActorIds.value.includes(actor.id) && !removedActorIds.value.includes(actor.actorId))
])

const orderedActors = computed(() => {
  if (!orderIds.value.length) return actors.value
  const byId = new Map(actors.value.map((actor) => [actor.id, actor]))
  const ordered = orderIds.value.map((id) => byId.get(id)).filter(Boolean) as typeof actors.value
  return [...ordered, ...actors.value.filter((actor) => !orderIds.value.includes(actor.id))]
})
const activeMember = computed(() => orderedActors.value.find((actor) => actor.id === activeMemberId.value) || orderedActors.value[0])
const targetName = computed(() => actors.value.find((item) => item.actorId === form.targetId || item.id === form.targetId)?.name || 'Alvo')
const actorName = computed(() => actors.value.find((item) => item.actorId === form.actorId || item.id === form.actorId)?.name || form.npcName || 'NPC')
const sheetFields = computed(() => (props.fields || []).filter((field) => !['ROLL_RULE', 'FORMULA'].includes(field.category)))
const primaryResourceKey = computed(() => props.primaryResource || 'vida')
const primaryResourceLabel = computed(() => sheetFields.value.find((field) => field.key === primaryResourceKey.value)?.label || primaryResourceKey.value)
const myActor = computed(() => props.members.find((member) => member.user?.id === props.currentUserId))
let timer: ReturnType<typeof setInterval> | null = null

watch(open, (next) => {
  if (!next || !props.isMaster) return
  form.actorId = activeMember.value?.actorId || ''
  form.targetId = actors.value[0]?.actorId || ''
  form.npcId = ''
  form.fieldKey = sheetFields.value[0]?.key || ''
  eventContent.value = buildContent()
})

watch(() => props.members, () => {
  if (!activeMemberId.value && actors.value[0]) activeMemberId.value = actors.value[0].id
}, { immediate: true })

watch([action, () => ({ ...form })], () => {
  eventContent.value = buildContent()
}, { deep: true })

async function loadTurn() {
  const response = await $fetch<{ messages: Array<{ id: string; type: string; metadataJson?: Record<string, unknown> | null }> }>(`/api/rooms/${props.roomId}/messages`)
  const inserted = new Map<string, { id: string; name: string }>()
  const removed = new Set<string>()
  response.messages.forEach((message) => {
    const metadata = message.metadataJson
    if (message.type === 'EVENT' && metadata?.action === 'INSERT_NPC') {
      const id = typeof metadata.npcSceneId === 'string' ? metadata.npcSceneId : `npc:${metadata.npcName || inserted.size + 1}`
      const name = typeof metadata.npcName === 'string' ? metadata.npcName : 'NPC'
      inserted.set(id, { id, name })
    }
    if (message.type === 'EVENT' && metadata?.action === 'REMOVE_ACTOR') {
      const targetId = typeof metadata.targetId === 'string' ? metadata.targetId : ''
      if (targetId) {
        removed.add(targetId)
        inserted.delete(targetId)
      }
    }
  })
  sceneNpcs.value = [...inserted.values()]
  removedActorIds.value = [...removed]

  const orderMessage = [...response.messages].reverse().find((message) => {
    const metadata = message.metadataJson
    return message.type === 'EVENT' && metadata?.action === 'INITIATIVE_ORDER'
  })
  if (Array.isArray(orderMessage?.metadataJson?.orderIds)) {
    orderIds.value = orderMessage.metadataJson.orderIds.map(String)
  }

  const turnMessage = [...response.messages].reverse().find((message) => {
    const metadata = message.metadataJson
    return message.type === 'EVENT' && metadata?.action === 'TURN'
  })

  const nextId = typeof turnMessage?.metadataJson?.activeMemberId === 'string' ? turnMessage.metadataJson.activeMemberId : ''
  activeMemberId.value = nextId || actors.value[0]?.id || ''

  const resolvedRequestIds = new Set(response.messages
    .map((message) => message.metadataJson?.requestId)
    .filter((id): id is string => typeof id === 'string'))

  if (props.isMaster) {
    response.messages.forEach((message) => {
      const metadata = message.metadataJson
      if (message.type !== 'EVENT' || metadata?.action !== 'PLAYER_FIELD_CHANGE_REQUEST' || seenRequests.value.has(message.id)) return
      if (resolvedRequestIds.has(message.id)) return
      if (metadata.status && metadata.status !== 'PENDING') return
      seenRequests.value.add(message.id)
      const characterName = typeof metadata.characterName === 'string' ? metadata.characterName : 'Jogador'
      const fieldLabel = typeof metadata.fieldLabel === 'string' ? metadata.fieldLabel : 'campo'
      const nextValue = String(metadata.fieldValue ?? '')
      push(`${characterName} pediu alterar ${fieldLabel} para ${nextValue}.`, 'info', [
        { label: 'Aprovar', run: () => approveFieldRequest(message.id, metadata) },
        { label: 'Negar', run: () => denyFieldRequest(message.id, metadata) }
      ])
    })
  } else {
    for (const message of response.messages) {
      const metadata = message.metadataJson
      const actionName = String(metadata?.action || '')
      if (!['DAMAGE', 'HEAL', 'ATTACK'].includes(actionName)) continue
      if (metadata?.targetId !== props.currentCharacterId) continue
      if (seenSheetUpdates.value.has(message.id) || resolvedRequestIds.has(message.id)) continue

      const amount = Number(metadata?.amount || 0)
      if (!amount || amount < 0) continue

      seenSheetUpdates.value.add(message.id)
      pendingSheetUpdate.value = {
        requestId: message.id,
        action: actionName as 'DAMAGE' | 'HEAL' | 'ATTACK',
        amount,
        fieldKey: primaryResourceKey.value,
        fieldLabel: primaryResourceLabel.value,
        content: buildSheetUpdateText(actionName, amount)
      }
      break
    }
  }
}

async function loadNpcs() {
  const response = await $fetch<{ npcs: typeof npcs.value }>('/api/npcs')
  npcs.value = response.npcs
}

async function skipTurn() {
  const currentIndex = Math.max(0, orderedActors.value.findIndex((actor) => actor.id === activeMember.value?.id))
  const nextActor = orderedActors.value[(currentIndex + 1) % Math.max(orderedActors.value.length, 1)]
  if (!nextActor) return

  loading.value = true
  try {
    await $fetch(`/api/rooms/${props.roomId}/messages`, {
      method: 'POST',
      body: {
        type: 'EVENT',
        content: `Turno de ${nextActor.name}.`,
        metadataJson: { action: 'TURN', activeMemberId: nextActor.id }
      }
    })
    activeMemberId.value = nextActor.id
    emit('eventCreated')
  } catch (error) {
    apiError(error, 'Nao foi possivel pular o turno.')
  } finally {
    loading.value = false
  }
}

async function saveOrder() {
  if (!props.isMaster) return
  try {
    await $fetch(`/api/rooms/${props.roomId}/messages`, {
      method: 'POST',
      body: {
        type: 'EVENT',
        content: 'Mestre reorganizou a iniciativa.',
        metadataJson: { action: 'INITIATIVE_ORDER', orderIds: orderedActors.value.map((actor) => actor.id) }
      }
    })
    emit('eventCreated')
  } catch (error) {
    apiError(error, 'Nao foi possivel salvar a ordem da iniciativa.')
  }
}

function dragStart(id: string) {
  if (!props.isMaster) return
  draggingId.value = id
}

async function dropOn(targetId: string) {
  if (!props.isMaster || !draggingId.value || draggingId.value === targetId) return
  const next = orderedActors.value.map((actor) => actor.id)
  const from = next.indexOf(draggingId.value)
  const to = next.indexOf(targetId)
  if (from < 0 || to < 0) return
  const [moved] = next.splice(from, 1)
  if (!moved) return
  next.splice(to, 0, moved)
  orderIds.value = next
  draggingId.value = ''
  await saveOrder()
}

async function submitEvent() {
  const content = eventContent.value.trim() || buildContent()
  if (!content) return

  const selectedNpc = npcs.value.find((npc) => npc.id === form.npcId)
  const npcName = selectedNpc?.name || form.npcName.trim() || `NPC ${sceneNpcs.value.length + 1}`
  const npcSceneId = selectedNpc ? `npc:${selectedNpc.id}` : `npc:${Date.now()}`
  const selectedField = sheetFields.value.find((field) => field.key === form.fieldKey)
  const selectedTarget = actors.value.find((item) => item.actorId === form.targetId || item.id === form.targetId)

  if (!props.isMaster && action.value === 'FIELD_CHANGE') {
    loading.value = true
    try {
      await $fetch(`/api/rooms/${props.roomId}/messages`, {
        method: 'POST',
        body: {
          type: 'EVENT',
          characterId: props.currentCharacterId,
          content,
          metadataJson: {
            action: 'PLAYER_FIELD_CHANGE_REQUEST',
            status: 'PENDING',
            characterId: props.currentCharacterId,
            characterName: myActor.value?.character?.name || myActor.value?.user?.name || 'Jogador',
            fieldKey: form.fieldKey,
            fieldLabel: selectedField?.label || form.fieldKey,
            fieldValue: form.fieldValue
          }
        }
      })
      push('Pedido enviado para o mestre.', 'success')
      open.value = false
      emit('eventCreated')
    } catch (error) {
      apiError(error, 'Nao foi possivel pedir a alteracao.')
    } finally {
      loading.value = false
    }
    return
  }

  loading.value = true
  try {
    await $fetch(`/api/rooms/${props.roomId}/messages`, {
      method: 'POST',
      body: {
        type: 'EVENT',
        content,
        metadataJson: {
          action: action.value,
          ...form,
          npcName,
          npcSceneId,
          targetName: selectedTarget?.name,
          fieldKey: ['DAMAGE', 'HEAL', 'ATTACK'].includes(action.value) ? primaryResourceKey.value : form.fieldKey
        }
      }
    })
    open.value = false
    emit('eventCreated')
  } catch (error) {
    apiError(error, 'Nao foi possivel adicionar o evento.')
  } finally {
    loading.value = false
  }
}

async function approveFieldRequest(requestId: string, metadata: Record<string, unknown>) {
  const fieldKey = typeof metadata.fieldKey === 'string' ? metadata.fieldKey : ''
  if (!fieldKey) return

  try {
    await $fetch(`/api/rooms/${props.roomId}/messages`, {
      method: 'POST',
      body: {
        type: 'EVENT',
        content: `Mestre aprovou a alteracao de ${metadata.fieldLabel || fieldKey} para ${metadata.fieldValue}.`,
        metadataJson: { action: 'PLAYER_FIELD_CHANGE_APPROVED', requestId, status: 'APPROVED' }
      }
    })
    emit('eventCreated')
  } catch (error) {
    apiError(error, 'Nao foi possivel aprovar a alteracao.')
  }
}

async function denyFieldRequest(requestId: string, metadata: Record<string, unknown>) {
  try {
    await $fetch(`/api/rooms/${props.roomId}/messages`, {
      method: 'POST',
      body: {
        type: 'EVENT',
        content: `Mestre negou a alteracao de ${metadata.fieldLabel || 'campo da ficha'}.`,
        metadataJson: { action: 'PLAYER_FIELD_CHANGE_DENIED', requestId, status: 'DENIED' }
      }
    })
    emit('eventCreated')
  } catch (error) {
    apiError(error, 'Nao foi possivel negar a alteracao.')
  }
}

function buildContent() {
  const selectedNpc = npcs.value.find((npc) => npc.id === form.npcId)
  const npcName = selectedNpc?.name || form.npcName.trim() || `NPC ${sceneNpcs.value.length + 1}`
  if (action.value === 'INSERT_NPC') return `NPC ${npcName} entrou na cena.`
  if (action.value === 'REMOVE_ACTOR') return `${targetName.value} saiu da iniciativa/cena.`
  if (action.value === 'ATTACK') {
    const damage = Number(form.amount || 0)
    return `${actorName.value} atacou ${targetName.value}${damage > 0 ? ` causando ${damage} de dano` : ''}.`
  }
  if (action.value === 'DAMAGE') return `${targetName.value} recebeu ${Number(form.amount || 0)} de dano.`
  if (action.value === 'HEAL') return `${targetName.value} recuperou ${Number(form.amount || 0)} de vida.`
  if (action.value === 'REWARD') return `${targetName.value} recebeu ${form.reward || 'uma recompensa'}.`
  if (action.value === 'FIELD_CHANGE') {
    const selectedField = sheetFields.value.find((field) => field.key === form.fieldKey)
    const name = myActor.value?.character?.name || myActor.value?.user?.name || 'Jogador'
    return `${name} pediu para alterar ${selectedField?.label || form.fieldKey} para ${form.fieldValue || 'novo valor'}.`
  }
  return form.note || 'O mestre adicionou um evento na mesa.'
}

function buildSheetUpdateText(actionName: string, amount: number) {
  if (actionName === 'HEAL') return `O mestre indicou que voce recuperou ${amount} de ${primaryResourceLabel.value}. Aplicar na ficha?`
  return `O mestre indicou que voce tomou ${amount} de dano. Aplicar em ${primaryResourceLabel.value}?`
}

async function answerSheetUpdate(accepted: boolean) {
  if (!pendingSheetUpdate.value || !props.currentCharacterId) return
  const update = pendingSheetUpdate.value
  pendingSheetUpdate.value = null

  try {
    if (accepted) {
      const owner = props.members.find((member) => member.character?.id === props.currentCharacterId)
      const current = Number(owner?.character?.dataJson?.[update.fieldKey] || 0)
      const nextValue = update.action === 'HEAL' ? current + update.amount : Math.max(0, current - update.amount)

      await $fetch(`/api/characters/${props.currentCharacterId}`, {
        method: 'PUT',
        body: { dataJson: { [update.fieldKey]: nextValue } }
      })
      push('Ficha atualizada.', 'success')
    }

    await $fetch(`/api/rooms/${props.roomId}/messages`, {
      method: 'POST',
      body: {
        type: 'EVENT',
        characterId: props.currentCharacterId,
        content: accepted ? 'Jogador aplicou a alteracao na ficha.' : 'Jogador recusou a alteracao automatica da ficha.',
        metadataJson: {
          action: 'PLAYER_SHEET_UPDATE_RESPONSE',
          requestId: update.requestId,
          status: accepted ? 'ACCEPTED' : 'DECLINED'
        }
      }
    })
    emit('eventCreated')
  } catch (error) {
    apiError(error, 'Nao foi possivel atualizar a ficha.')
  }
}

onMounted(() => {
  loadNpcs()
  loadTurn()
  timer = setInterval(loadTurn, 2200)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <AppCard class="flex h-[360px] flex-col">
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-lg font-black uppercase text-white">Iniciativa</h3>
      <AppButton v-if="isMaster" variant="ghost" type="button" @click="open = true"><Plus class="h-4 w-4" />Evento</AppButton>
    </div>
    <ol class="mt-4 min-h-[190px] flex-1 space-y-2 overflow-y-auto pr-2">
      <li
        v-for="actor in orderedActors"
        :key="actor.id"
        :draggable="isMaster"
        class="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
        :class="activeMember?.id === actor.id ? 'border-ember/50 bg-ember/10' : 'border-transparent bg-white/[0.02]'"
        @dragstart="dragStart(actor.id)"
        @dragover.prevent
        @drop="dropOn(actor.id)"
      >
        <span class="flex min-w-0 items-center gap-2 font-bold" :class="activeMember?.id === actor.id ? 'text-ember' : 'text-mist'">
          <GripVertical v-if="isMaster" class="h-4 w-4 cursor-grab text-mist" />
          <span class="truncate">{{ actor.name }}</span>
        </span>
      </li>
    </ol>
    <AppButton v-if="isMaster" class="mt-4 w-full" type="button" variant="subtle" :loading="loading" @click="skipTurn">Pular turno</AppButton>
  </AppCard>

  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div class="w-full max-w-3xl rounded-xl border border-white/10 bg-panel p-5 shadow-soft">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xl font-black text-white">Adicionar evento</h2>
          <button type="button" class="rounded-lg p-2 text-mist hover:bg-white/10 hover:text-white" @click="open = false">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-[180px_1fr]">
          <p class="font-black uppercase text-ember">Tipo de acao</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in actionOptions"
              :key="option.value"
              type="button"
              class="rounded-lg border px-3 py-2 text-sm font-black"
              :class="action === option.value ? 'border-ember bg-ember/15 text-ember' : 'border-white/10 bg-white/[0.04] text-mist hover:text-white'"
              @click="action = option.value"
            >
              {{ option.label }}
            </button>
          </div>

          <template v-if="action === 'INSERT_NPC'">
            <p class="font-black uppercase text-ember">NPC da cena</p>
            <div class="grid gap-2 md:grid-cols-2">
              <select v-model="form.npcId" class="select">
                <option value="">Criar NPC rapido</option>
                <option v-for="npc in npcs" :key="npc.id" :value="npc.id">{{ npc.name }}</option>
              </select>
              <input v-if="!form.npcId" v-model="form.npcName" class="input" placeholder="Nome do NPC rapido, ex: Guarda ferido">
            </div>
          </template>

          <template v-if="action === 'FIELD_CHANGE'">
            <p class="font-black uppercase text-ember">Campo da ficha</p>
            <div class="grid gap-2 md:grid-cols-2">
              <select v-model="form.fieldKey" class="select">
                <option v-for="field in sheetFields" :key="field.key" :value="field.key">{{ field.label }}</option>
              </select>
              <input v-model="form.fieldValue" class="input" placeholder="Novo valor">
            </div>
          </template>

          <template v-if="action === 'ATTACK'">
            <p class="font-black uppercase text-ember">Personagem atacante</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="actor in actors"
                :key="actor.id"
                type="button"
                class="rounded-lg border px-3 py-2 text-sm font-bold"
                :class="form.actorId === actor.actorId ? 'border-ember bg-ember/15 text-white' : 'border-white/10 bg-white/[0.04] text-mist hover:text-white'"
                @click="form.actorId = actor.actorId"
              >
                {{ actor.name }}
              </button>
            </div>
          </template>

          <template v-if="action !== 'INSERT_NPC' && action !== 'NOTE' && action !== 'FIELD_CHANGE'">
            <p class="font-black uppercase text-ember">{{ action === 'REMOVE_ACTOR' ? 'Quem sai' : 'Alvo' }}</p>
            <div class="max-h-32 overflow-y-auto pr-2">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="actor in actors"
                  :key="actor.id"
                  type="button"
                  class="rounded-lg border px-3 py-2 text-sm font-bold"
                  :class="form.targetId === actor.actorId ? 'border-ember bg-ember/15 text-white' : 'border-white/10 bg-white/[0.04] text-mist hover:text-white'"
                  @click="form.targetId = actor.actorId"
                >
                  {{ actor.name }}
                </button>
              </div>
            </div>
          </template>

          <template v-if="action === 'ATTACK' || action === 'DAMAGE' || action === 'HEAL'">
            <p class="font-black uppercase text-ember">Valor</p>
            <input v-model.number="form.amount" type="number" min="0" class="input">
          </template>

          <template v-if="action === 'REWARD'">
            <p class="font-black uppercase text-ember">Recompensa</p>
            <input v-model="form.reward" class="input" placeholder="50 XP, item, pista...">
          </template>

          <template v-if="action === 'NOTE'">
            <p class="font-black uppercase text-ember">Mensagem</p>
            <textarea v-model="form.note" rows="4" class="input" placeholder="Aviso publico para a mesa..." />
          </template>
        </div>

        <label class="mt-5 block">
          <span class="label">Texto que vai para o log</span>
          <textarea v-model="eventContent" rows="3" class="input" />
        </label>

        <div class="mt-5 flex justify-end gap-2">
          <AppButton variant="ghost" type="button" @click="open = false">Cancelar</AppButton>
          <AppButton type="button" :loading="loading" @click="submitEvent">Enviar evento</AppButton>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="pendingSheetUpdate" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div class="w-full max-w-md rounded-xl border border-white/10 bg-panel p-5 shadow-soft">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xl font-black text-white">Atualizar ficha?</h2>
          <button type="button" class="rounded-lg p-2 text-mist hover:bg-white/10 hover:text-white" @click="answerSheetUpdate(false)">
            <X class="h-5 w-5" />
          </button>
        </div>
        <p class="mt-4 leading-6 text-mist">{{ pendingSheetUpdate.content }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <AppButton variant="ghost" type="button" @click="answerSheetUpdate(false)">Nao aplicar</AppButton>
          <AppButton type="button" @click="answerSheetUpdate(true)">Aplicar agora</AppButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

