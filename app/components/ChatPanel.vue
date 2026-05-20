<script setup lang="ts">
import { ArrowDown, MoreHorizontal, Send, X } from 'lucide-vue-next'

type RoomMember = {
  id: string
  role: string
  user?: { id: string; name: string; profileColor?: string | null } | null
  character?: { id: string; name: string; avatarUrl?: string | null } | null
}

type RoomMessage = {
  id: string
  type: string
  content: string
  createdAt: string
  metadataJson?: Record<string, unknown> | null
  user?: { id: string; name: string; profileColor?: string | null } | null
  character?: { name: string } | null
}

const props = defineProps<{
  roomId: string
  characterId?: string | null
  members: RoomMember[]
  currentUserId?: string | null
  isMaster?: boolean
  dmUserId?: string | null
  unreadByUserId?: Record<string, number>
}>()

const emit = defineEmits<{ privateReceived: [userId: string]; clearDm: [userId: string]; closeDm: [] }>()
const { push, apiError } = useToast()
const messages = ref<RoomMessage[]>([])
const content = ref('')
const loading = ref(false)
const tab = ref<'TABLE' | 'LOG' | 'SECRET' | 'DM'>('TABLE')
const scroller = ref<HTMLElement | null>(null)
const menuMessageId = ref<string | null>(null)
const knownMessageIds = ref(new Set<string>())
const knownSecretCount = ref(0)
const showJumpToBottom = ref(false)
let disposed = false
let timer: ReturnType<typeof setInterval> | null = null

const activeDmMember = computed(() => props.members.find((member) => member.user?.id === props.dmUserId))
const activeDmName = computed(() => activeDmMember.value?.character?.name || activeDmMember.value?.user?.name || 'DM')
const secretRolls = computed(() => messages.value.filter((message) => message.type === 'ROLL' && Boolean(message.metadataJson?.secretDice)))
const hasSecretChat = computed(() => Boolean(props.isMaster && secretRolls.value.length))

const visibleMessages = computed(() => {
  if (tab.value === 'DM') {
    return messages.value.filter((message) => message.type === 'PRIVATE' && isActivePrivateMessage(message))
  }

  if (tab.value === 'LOG') {
    return messages.value.filter((message) => ['SYSTEM', 'EVENT', 'ROLL'].includes(message.type))
  }

  if (tab.value === 'SECRET') {
    return secretRolls.value
  }

  return messages.value.filter((message) => message.type !== 'PRIVATE')
})

watch(() => props.dmUserId, (next) => {
  if (next) {
    tab.value = 'DM'
    emit('clearDm', next)
  }
})

async function load() {
  const response = await $fetch<{ messages: RoomMessage[] }>(`/api/rooms/${props.roomId}/messages`)
  if (disposed) return
  const wasNearBottom = !scroller.value || scroller.value.scrollHeight - scroller.value.scrollTop - scroller.value.clientHeight < 80
  notifyPrivateMessages(response.messages)
  messages.value = response.messages
  if (props.isMaster && secretRolls.value.length > knownSecretCount.value) {
    tab.value = 'SECRET'
  }
  knownSecretCount.value = secretRolls.value.length
  await nextTick()
  if (wasNearBottom) scrollToEnd()
  updateJumpButton()
}

async function send() {
  if (!content.value.trim()) return
  if (tab.value === 'DM' && !props.dmUserId) return

  loading.value = true
  try {
    await $fetch(`/api/rooms/${props.roomId}/messages`, {
      method: 'POST',
      body: {
        content: content.value,
        characterId: props.characterId,
        type: tab.value === 'DM' ? 'PRIVATE' : 'CHAT',
        metadataJson: tab.value === 'DM' ? { targetUserId: props.dmUserId } : undefined
      }
    })
    content.value = ''
    await load()
  } catch (error) {
    apiError(error, 'Nao foi possivel enviar a mensagem.')
  } finally {
    loading.value = false
  }
}

function isActivePrivateMessage(message: RoomMessage) {
  if (!props.currentUserId || !props.dmUserId) return false

  const recipients = Array.isArray(message.metadataJson?.recipientUserIds)
    ? message.metadataJson.recipientUserIds.map(String)
    : []

  return recipients.includes(props.currentUserId) && recipients.includes(props.dmUserId)
}

function colorForUser(userId?: string | null) {
  if (!userId) return '#ff8a13'
  return props.members.find((member) => member.user?.id === userId)?.user?.profileColor || '#ff8a13'
}

function displayName(message: RoomMessage) {
  if (message.type === 'SYSTEM' || message.type === 'EVENT') return 'Sistema'
  return message.character?.name || message.user?.name || 'Sistema'
}

function messageColor(message: RoomMessage) {
  if (message.type === 'SYSTEM' || message.type === 'EVENT') return '#ff8a13'
  return colorForUser(message.user?.id)
}

function messageStyle(message: RoomMessage) {
  const color = messageColor(message)
  return {
    backgroundColor: `${color}24`,
    borderColor: `${color}55`,
    borderLeftColor: color
  }
}

function canShare(message: RoomMessage) {
  return ['SYSTEM', 'EVENT', 'ROLL'].includes(message.type)
}

function unreadFor(userId?: string | null) {
  return userId ? props.unreadByUserId?.[userId] || 0 : 0
}

function closePrivateChat() {
  if (props.dmUserId) emit('clearDm', props.dmUserId)
  tab.value = 'TABLE'
  emit('closeDm')
}

function closeSecretChat() {
  tab.value = 'TABLE'
}

function secretContent(message: RoomMessage) {
  const dice = message.metadataJson?.secretDice as { expression?: string; result?: number; rolls?: Array<{ count: number; sides: number; values: number[] }>; modifier?: number } | undefined
  if (!dice) return message.content
  const rolls = Array.isArray(dice.rolls)
    ? dice.rolls.map((roll) => `${roll.count}d${roll.sides}: ${roll.values.join(', ')}`).join(' | ')
    : ''
  const modifier = dice.modifier ? `, modificador ${dice.modifier > 0 ? '+' : ''}${dice.modifier}` : ''
  return `${displayName(message)} rolou ${dice.expression}. Resultado: ${dice.result}${rolls ? ` (${rolls}${modifier})` : ''}.`
}

function notifyPrivateMessages(nextMessages: RoomMessage[]) {
  const hasKnownMessages = knownMessageIds.value.size > 0
  const nextIds = new Set(nextMessages.map((message) => message.id))

  if (hasKnownMessages) {
    for (const message of nextMessages) {
      if (knownMessageIds.value.has(message.id) || message.type !== 'PRIVATE') continue
      if (!message.user?.id || message.user.id === props.currentUserId) continue

      const recipients = Array.isArray(message.metadataJson?.recipientUserIds)
        ? message.metadataJson.recipientUserIds.map(String)
        : []

      if (props.currentUserId && recipients.includes(props.currentUserId)) {
        emit('privateReceived', message.user.id)
      }
    }
  }

  knownMessageIds.value = nextIds
}

async function shareMessage(message: RoomMessage) {
  try {
    await $fetch(`/api/rooms/${props.roomId}/messages/${message.id}/share`, { method: 'POST' })
    menuMessageId.value = null
    push('Mensagem compartilhada no feed recente.', 'success')
    await load()
  } catch (error) {
    apiError(error, 'Nao foi possivel compartilhar a mensagem.')
  }
}

function scrollToEnd() {
  if (!scroller.value) return
  scroller.value.scrollTop = scroller.value.scrollHeight
  updateJumpButton()
}

function updateJumpButton() {
  if (!scroller.value) {
    showJumpToBottom.value = false
    return
  }

  showJumpToBottom.value = scroller.value.scrollHeight - scroller.value.scrollTop - scroller.value.clientHeight > 90
}

defineExpose({ load })
onMounted(() => {
  load()
  timer = setInterval(load, 2200)
})

onBeforeUnmount(() => {
  disposed = true
  if (timer) clearInterval(timer)
})
</script>

<template>
  <AppCard class="flex h-[620px] flex-col p-0">
    <div class="border-b border-white/10 p-3">
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="rounded-md px-3 py-2 text-sm font-black transition" :class="tab === 'TABLE' ? 'bg-ember text-black' : 'text-mist hover:bg-white/10 hover:text-white'" @click="tab = 'TABLE'">Mesa</button>
        <button type="button" class="rounded-md px-3 py-2 text-sm font-black transition" :class="tab === 'LOG' ? 'bg-ember text-black' : 'text-mist hover:bg-white/10 hover:text-white'" @click="tab = 'LOG'">Historico</button>
        <button v-if="hasSecretChat" type="button" class="rounded-md px-3 py-2 text-sm font-black transition" :class="tab === 'SECRET' ? 'bg-ember text-black' : 'text-mist hover:bg-white/10 hover:text-white'" @click="tab = 'SECRET'">Secretas</button>
        <button v-if="dmUserId" type="button" class="rounded-md px-3 py-2 text-sm font-black transition" :class="tab === 'DM' ? 'bg-ember text-black' : 'text-mist hover:bg-white/10 hover:text-white'" @click="tab = 'DM'; emit('clearDm', dmUserId)">
          {{ activeDmName }}
        </button>
        <span v-if="dmUserId && unreadFor(dmUserId)" class="h-5 min-w-5 rounded-full bg-flare px-1.5 text-center text-xs font-black text-white">{{ unreadFor(dmUserId) }}</span>
        <button v-if="tab === 'SECRET'" type="button" class="ml-auto grid h-8 w-8 place-items-center rounded-lg text-mist hover:bg-white/10 hover:text-white" title="Fechar rolagens secretas" @click="closeSecretChat">
          <X class="h-4 w-4" />
        </button>
        <button v-if="dmUserId" type="button" :class="tab === 'SECRET' ? '' : 'ml-auto'" class="grid h-8 w-8 place-items-center rounded-lg text-mist hover:bg-white/10 hover:text-white" title="Fechar chat privado" @click="closePrivateChat">
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>
    <div class="relative min-h-0 flex-1 p-4">
      <div ref="scroller" class="h-full min-h-[320px] space-y-3 overflow-y-auto pr-2" @scroll="updateJumpButton">
        <div
          v-for="message in visibleMessages"
          :key="message.id"
          class="relative rounded-lg border p-3"
          :style="messageStyle(message)"
          :class="{
            'border-arcane/35 bg-arcane/10': message.type === 'ROLL',
            'border-ember/35 bg-ember/10': message.type === 'SYSTEM' || message.type === 'EVENT',
            'border-white/10 bg-white/[0.04]': message.type === 'CHAT',
            'border-white/10 bg-white/[0.05]': message.type === 'PRIVATE'
          }"
        >
          <button
            v-if="canShare(message)"
            type="button"
            class="absolute right-3 top-3 rounded-md p-1 text-mist hover:bg-white/10 hover:text-white"
            title="Opcoes da mensagem"
            @click="menuMessageId = menuMessageId === message.id ? null : message.id"
          >
            <MoreHorizontal class="h-5 w-5" />
          </button>
          <div v-if="menuMessageId === message.id" class="absolute right-3 top-10 z-10 rounded-lg border border-white/10 bg-panel p-1 shadow-soft">
            <button type="button" class="block rounded-md px-3 py-2 text-left text-sm font-bold text-white hover:bg-white/10" @click="shareMessage(message)">
              Compartilhar
            </button>
          </div>
          <p class="pr-9 text-sm font-black text-white">
            <span v-if="message.type === 'PRIVATE'" class="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-mist">DM</span>
            {{ displayName(message) }}
          </p>
          <p class="mt-1 whitespace-pre-wrap text-sm leading-6 text-white">{{ tab === 'SECRET' ? secretContent(message) : message.content }}</p>
          <p class="mt-1 text-xs text-mist">{{ new Date(message.createdAt).toLocaleString('pt-BR') }}</p>
        </div>
        <div v-if="visibleMessages.length === 0" class="rounded-lg border border-dashed border-white/15 p-8 text-center text-mist">Nada por aqui ainda.</div>
      </div>
      <button v-if="showJumpToBottom" type="button" class="absolute bottom-3 right-4 grid h-9 w-9 place-items-center rounded-full border border-ember/40 bg-panel/95 text-ember shadow-soft hover:bg-ember hover:text-black" title="Ir para a ultima mensagem" @click="scrollToEnd">
        <ArrowDown class="h-4 w-4" />
      </button>
    </div>
    <form v-if="tab !== 'LOG' && tab !== 'SECRET'" class="flex shrink-0 gap-2 border-t border-white/10 p-3" @submit.prevent="send">
      <input v-model="content" class="input" :placeholder="tab === 'DM' ? `Mensagem privada para ${activeDmName}...` : 'Digite no chat da mesa...'">
      <AppButton type="submit" :loading="loading"><Send class="h-4 w-4" />Enviar</AppButton>
    </form>
  </AppCard>
</template>
