<script setup lang="ts">
import { ArrowLeft, Heart, MessageCircle, PlusCircle } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

type CommentItem = {
  id: string
  content: string
  createdAt: string
  updatedAt?: string | null
  user?: { id: string; name: string; avatarUrl?: string | null; profileColor?: string | null } | null
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { push, apiError } = useToast()
const adding = ref(false)
const comment = ref('')
const commenting = ref(false)

const { data, refresh } = await useFetch<{ npc: {
  id: string
  name: string
  description?: string | null
  avatarUrl?: string | null
  isCommunity: boolean
  moderationStatus?: string
  moderationReason?: string | null
  system?: { id: string; name: string } | null
  createdById?: string | null
  createdBy?: { id: string; name: string; avatarUrl?: string | null } | null
  dataJson: Record<string, unknown>
  likes?: Array<{ id: string }>
  comments?: CommentItem[]
  _count?: { likes: number; comments: number }
} }>(`/api/npcs/${route.params.id}`)

const isOwner = computed(() => data.value?.npc.createdById === auth.user?.id)
const isRejected = computed(() => data.value?.npc.moderationStatus === 'REJECTED')
const liked = computed(() => Boolean(data.value?.npc.likes?.length))
const attacks = computed(() => Array.isArray(data.value?.npc.dataJson.attacks) ? data.value.npc.dataJson.attacks as Array<Record<string, unknown>> : [])
const statEntries = computed(() => Object.entries(data.value?.npc.dataJson || {}).filter(([key, value]) => key !== 'attacks' && typeof value !== 'object'))

function goBack() {
  if (import.meta.client && window.history.length > 1) {
    router.back()
    return
  }
  navigateTo('/app/community?type=npc')
}

async function toggleLike() {
  try {
    await $fetch(`/api/npcs/${route.params.id}/like`, { method: 'POST' })
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel curtir o NPC.')
  }
}

async function addToInventory() {
  adding.value = true
  try {
    await $fetch(`/api/npcs/${route.params.id}/clone`, { method: 'POST' })
    push('NPC adicionado ao seu inventario.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel adicionar o NPC.')
  } finally {
    adding.value = false
  }
}

async function sendComment() {
  if (!comment.value.trim()) return
  commenting.value = true
  try {
    await $fetch(`/api/npcs/${route.params.id}/comments`, { method: 'POST', body: { content: comment.value } })
    comment.value = ''
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel comentar.')
  } finally {
    commenting.value = false
  }
}
</script>

<template>
  <div v-if="data?.npc" class="space-y-5">
    <button type="button" class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-mist hover:text-white" @click="goBack">
      <ArrowLeft class="h-4 w-4" />
      Voltar
    </button>

    <AppCard>
      <div class="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div class="aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
          <img v-if="data.npc.avatarUrl" :src="data.npc.avatarUrl" :alt="data.npc.name" class="h-full w-full object-cover">
          <div v-else class="grid h-full place-items-center text-6xl font-black text-ember">{{ data.npc.name.slice(0, 1).toUpperCase() }}</div>
        </div>
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-ember">{{ data.npc.system?.name || 'NPC generico' }}</p>
            <span v-if="data.npc.moderationStatus" class="rounded-md border px-2 py-1 text-xs font-bold" :class="isRejected ? 'border-flare/35 bg-flare/10 text-red-100' : data.npc.moderationStatus === 'PENDING' ? 'border-amber-300/30 bg-amber-300/10 text-amber-100' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'">
              {{ data.npc.moderationStatus === 'PENDING' ? 'Em analise' : data.npc.moderationStatus === 'REJECTED' ? 'Rejeitado' : 'Aprovado' }}
            </span>
          </div>
          <h1 class="mt-2 page-title">{{ data.npc.name }}</h1>
          <p class="mt-3 max-w-3xl leading-7 text-mist">{{ data.npc.description || 'Sem descricao.' }}</p>
          <p v-if="isRejected" class="mt-3 rounded-lg border border-flare/35 bg-flare/10 p-3 text-sm font-bold text-red-100">
            Este NPC foi rejeitado e esta bloqueado para edicao. {{ data.npc.moderationReason ? `Motivo: ${data.npc.moderationReason}` : 'Crie uma nova versao para enviar novamente.' }}
          </p>
          <p class="mt-3 text-sm text-mist">Criado por {{ data.npc.createdBy?.name || 'Jogador' }}</p>
          <div class="mt-5 flex flex-wrap gap-2">
            <button type="button" class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold" :class="liked ? 'border-ember bg-ember/15 text-ember' : 'border-white/10 bg-white/[0.04] text-white'" @click="toggleLike">
              <Heart class="h-4 w-4" />{{ data.npc._count?.likes || 0 }}
            </button>
            <span class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-mist">
              <MessageCircle class="h-4 w-4" />{{ data.npc._count?.comments || 0 }}
            </span>
            <AppButton v-if="!isOwner" variant="ghost" :loading="adding" @click="addToInventory">
              <PlusCircle class="h-4 w-4" />Adicionar ao inventario
            </AppButton>
            <NuxtLink v-if="isOwner && !isRejected" :to="`/app/npcs/${data.npc.id}/edit`"><AppButton variant="ghost">Editar NPC</AppButton></NuxtLink>
          </div>
        </div>
      </div>
    </AppCard>

    <div class="grid gap-5 xl:grid-cols-[1fr_360px]">
      <AppCard>
        <h2 class="text-xl font-black text-white">Ataques</h2>
        <div v-if="attacks.length" class="mt-4 space-y-3">
          <div v-for="attack in attacks" :key="String(attack.name)" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p class="font-black text-white">{{ attack.name || 'Ataque' }}</p>
            <p class="mt-1 text-sm font-bold text-ember">{{ attack.damage || 'Sem dano definido' }}</p>
            <p v-if="attack.description" class="mt-2 text-sm leading-6 text-mist">{{ attack.description }}</p>
          </div>
        </div>
        <p v-else class="mt-4 text-mist">Nenhum ataque cadastrado.</p>
      </AppCard>

      <AppCard>
        <h2 class="text-xl font-black text-white">Informacoes</h2>
        <dl class="mt-4 space-y-2">
          <div v-for="[key, value] in statEntries" :key="key" class="flex justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
            <dt class="font-bold capitalize text-mist">{{ key }}</dt>
            <dd class="font-black text-white">{{ value }}</dd>
          </div>
        </dl>
      </AppCard>
    </div>

    <AppCard>
      <h2 class="text-xl font-black text-white">Comentarios</h2>
      <div class="mt-4">
        <AppCommentThread
          :comments="data.npc.comments || []"
          :endpoint="`/api/npcs/${data.npc.id}/comments`"
          :current-user-id="auth.user?.id"
          @refresh="refresh"
        />
      </div>
    </AppCard>
  </div>
</template>
