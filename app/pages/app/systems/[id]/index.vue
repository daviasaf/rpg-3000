<script setup lang="ts">
import { ArrowLeft, Edit3, ExternalLink, Heart, MessageCircle, PlusCircle, Send, Star, Trash2, UserPlus } from 'lucide-vue-next'
import type { SystemSchema } from '../../../../../shared/types/system'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { push, apiError } = useToast()
const deleting = ref(false)
const adding = ref(false)
const confirmDeleteOpen = ref(false)
const publishOpen = ref(false)
const publishing = ref(false)
const likeLoading = ref(false)
const featuring = ref(false)
const comment = ref('')
const commenting = ref(false)
const { data, refresh } = await useFetch<{ system: {
  id: string
  name: string
  description: string
  avatarUrl?: string | null
  tags: string[]
  visibility: string
  moderationStatus?: string
  moderationReason?: string | null
  featuredOnProfile?: boolean
  createdById?: string | null
  createdBy?: { id: string; name: string } | null
  schemaJson?: SystemSchema
  fields: Array<{ id: string; key: string; label: string; type: string; category: string; defaultValue: unknown; formula?: string | null }>
  likes?: Array<{ id: string }>
  comments?: Array<{ id: string; content: string; createdAt: string; updatedAt?: string | null; user?: { id?: string; name?: string | null; avatarUrl?: string | null; profileColor?: string | null } | null }>
  _count?: { likes: number; comments: number; characters: number; rooms: number }
} }>(`/api/systems/${route.params.id}`)

const isOwner = computed(() => data.value?.system.createdById === auth.user?.id)
const isRejected = computed(() => data.value?.system.moderationStatus === 'REJECTED')
const isPending = computed(() => data.value?.system.moderationStatus === 'PENDING')
const canUseSystem = computed(() => data.value?.system.moderationStatus === 'APPROVED')
const classes = computed(() => data.value?.system.schemaJson?.classes || [])
const systemVersion = computed(() => String((data.value?.system.schemaJson as any)?.version || 'v1'))
const originalCreator = computed(() => (data.value?.system.schemaJson as any)?.provenance?.originalCreatorName || data.value?.system.createdBy?.name || 'Toca dos Nerds')
const liked = computed(() => Boolean(data.value?.system.likes?.length))
const fieldGroups = computed(() => {
  const order = ['ATTRIBUTE', 'RESOURCE', 'SKILL', 'TEXT_FIELD', 'ROLL_RULE', 'FORMULA', 'NUMERIC_FIELD', 'BOOLEAN_FIELD', 'LIST_FIELD', 'STATUS_BAR']
  return order
    .map((category) => ({
      category,
      fields: data.value?.system.fields.filter((field) => field.category === category) || []
    }))
    .filter((group) => group.fields.length)
})

function goBack() {
  if (import.meta.client && window.history.length > 1) {
    router.back()
    return
  }
  navigateTo('/app/systems')
}

async function deleteSystem() {
  if (!data.value?.system) return

  deleting.value = true
  try {
    await $fetch(`/api/systems/${data.value.system.id}`, { method: 'DELETE' })
    push('Sistema apagado.', 'success')
    await navigateTo('/app/systems')
  } catch (error) {
    apiError(error, 'Nao foi possivel apagar o sistema.')
  } finally {
    deleting.value = false
  }
}

async function toggleLike() {
  if (likeLoading.value) {
    push('Aguarde um instante antes de tentar novamente.', 'info')
    return
  }

  likeLoading.value = true
  try {
    await $fetch(`/api/systems/${route.params.id}/like`, { method: 'POST' })
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel curtir o sistema.')
  } finally {
    likeLoading.value = false
  }
}

async function addToInventory() {
  if (adding.value) {
    push('Essa acao ja esta sendo processada.', 'info')
    return
  }
  adding.value = true
  try {
    await $fetch(`/api/systems/${route.params.id}/clone`, { method: 'POST' })
    push('Sistema adicionado ao seu inventario.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel adicionar o sistema.')
  } finally {
    adding.value = false
  }
}

function ownerActions() {
  const system = data.value?.system
  return [
    { key: 'edit', label: 'Editar', icon: Edit3, disabled: isRejected.value },
    { key: 'publish', label: system?.moderationStatus === 'PENDING' ? 'Em analise' : 'Postar na comunidade', icon: Send, disabled: isRejected.value || system?.moderationStatus === 'PENDING' || publishing.value },
    {
      key: 'feature',
      label: system?.featuredOnProfile ? 'Remover destaque' : 'Destacar no perfil',
      icon: Star,
      disabled: isRejected.value || system?.moderationStatus !== 'APPROVED' || featuring.value
    },
    { key: 'delete', label: 'Apagar', icon: Trash2, danger: true, disabled: deleting.value }
  ]
}

async function handleOwnerAction(action: string) {
  const system = data.value?.system
  if (!system) return

  if (action === 'edit') {
    await navigateTo(`/app/systems/${system.id}/edit`)
  }
  if (action === 'publish') {
    publishOpen.value = true
  }
  if (action === 'feature') {
    await toggleFeatured()
  }
  if (action === 'delete') {
    confirmDeleteOpen.value = true
  }
}

function visitorActions() {
  return [
    { key: 'copy', label: 'Gerar uma copia', icon: PlusCircle, disabled: !canUseSystem.value },
    { key: 'profile', label: 'Ver perfil do criador', icon: UserPlus, disabled: !data.value?.system.createdBy?.id }
  ]
}

async function handleVisitorAction(action: string) {
  const system = data.value?.system
  if (!system) return
  if (action === 'copy') await addToInventory()
  if (action === 'profile' && system.createdBy?.id) await navigateTo(`/app/profile/${system.createdBy.id}`)
}

async function publishSystem() {
  const system = data.value?.system
  if (!system) return
  publishing.value = true
  try {
    await $fetch(`/api/systems/${system.id}/publish`, { method: 'POST' })
    push('Sistema enviado para analise da comunidade.', 'success')
    publishOpen.value = false
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel postar o sistema.')
  } finally {
    publishing.value = false
  }
}

async function toggleFeatured() {
  const system = data.value?.system
  if (!system || featuring.value) return

  featuring.value = true
  try {
    const response = await $fetch<{ featured: boolean }>('/api/profile/featured', {
      method: 'POST',
      body: { type: 'SYSTEM', id: system.id, featured: !system.featuredOnProfile }
    })
    system.featuredOnProfile = response.featured
    push(response.featured ? 'Sistema destacado no perfil.' : 'Destaque removido do perfil.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel alterar o destaque.')
  } finally {
    featuring.value = false
  }
}

async function sendComment() {
  if (!comment.value.trim()) return
  commenting.value = true
  try {
    await $fetch(`/api/systems/${route.params.id}/comments`, { method: 'POST', body: { content: comment.value } })
    comment.value = ''
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel comentar.')
  } finally {
    commenting.value = false
  }
}


function changeLine(change: { operation?: string, value?: unknown, targetLabel?: string | null, targetKey?: string | null, note?: string | null, type?: string | null }) {
  if (change.operation === 'NOTE') return change.note?.trim() || ''
  if (change.type === 'ATTRIBUTE_POINT') {
    const amount = Number(change.value || 1)
    return `${amount} ponto(s) livres de atributo${change.note ? ` - ${change.note}` : ''}`
  }

  const value = Number(change.value ?? 0)
  const target = change.targetLabel || change.targetKey || 'alvo'
  const operation = change.operation === 'SUBTRACT'
    ? `-${Math.abs(value)}`
    : change.operation === 'SET'
      ? `define ${value}`
      : value > 0
        ? `+${value}`
        : `${value}`

  if (!value && change.operation !== 'SET') return change.note?.trim() || ''
  return `${operation} em ${target}${change.note ? ` - ${change.note}` : ''}`
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    ATTRIBUTE: 'Atributos',
    RESOURCE: 'Recursos',
    SKILL: 'Pericias',
    TEXT_FIELD: 'Informacoes',
    ROLL_RULE: 'Regras de rolagem',
    FORMULA: 'Formulas',
    NUMERIC_FIELD: 'Numeros',
    BOOLEAN_FIELD: 'Marcadores',
    LIST_FIELD: 'Listas',
    STATUS_BAR: 'Estado'
  }
  return labels[category] || category
}
</script>

<template>
  <div v-if="data?.system" class="space-y-5">
    <button type="button" class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-mist hover:text-white" @click="goBack">
      <ArrowLeft class="h-4 w-4" />
      Voltar
    </button>

    <AppCard>
      <div class="grid gap-5 lg:grid-cols-[132px_minmax(0,1fr)]">
        <div class="flex justify-center lg:justify-start">
          <AppAvatar :name="data.system.name" :src="data.system.avatarUrl" size="2xl" />
        </div>
        <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap gap-2">
            <span v-for="tag in data.system.tags" :key="tag" class="rounded-md border border-ember/25 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">{{ tag }}</span>
            <span class="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-bold text-mist">{{ systemVersion }}</span>
            <span v-if="data.system.moderationStatus" class="rounded-md border px-2 py-1 text-xs font-bold" :class="isRejected ? 'border-flare/35 bg-flare/10 text-red-100' : data.system.moderationStatus === 'PENDING' ? 'border-amber-300/30 bg-amber-300/10 text-amber-100' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'">
              {{ data.system.moderationStatus === 'PENDING' ? 'Em analise' : data.system.moderationStatus === 'REJECTED' ? 'Rejeitado' : 'Aprovado' }}
            </span>
          </div>
          <h1 class="mt-4 page-title">{{ data.system.name }}</h1>
          <p class="mt-2 max-w-3xl text-mist">{{ data.system.description }}</p>
          <p v-if="isRejected" class="mt-3 rounded-lg border border-flare/35 bg-flare/10 p-3 text-sm font-bold text-red-100">
            Este sistema foi rejeitado e esta bloqueado para edicao. {{ data.system.moderationReason ? `Motivo: ${data.system.moderationReason}` : 'Crie uma nova versao para enviar novamente.' }}
          </p>
          <p v-if="isPending" class="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm font-bold text-amber-100">
            Este sistema ainda esta em analise. Voce pode editar ou apagar, mas nao pode usar em salas, destacar, postar novamente ou criar personagem ate ser aprovado.
          </p>
          <p class="mt-3 text-sm text-mist">Criador original: <b class="text-white">{{ originalCreator }}</b></p>
          <p v-if="!isOwner" class="mt-1 text-xs text-mist">Adicionar ao inventario cria uma copia privada sem alterar a autoria original.</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60" :class="liked ? 'border-ember bg-ember/15 text-ember' : 'border-white/10 bg-white/[0.04] text-white'" :disabled="likeLoading" @click="toggleLike">
              <span v-if="likeLoading" class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <Heart v-else class="h-4 w-4" />{{ data.system._count?.likes || 0 }}
            </button>
            <span class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-mist">
              <MessageCircle class="h-4 w-4" />{{ data.system._count?.comments || 0 }}
            </span>
            <NuxtLink :to="`/app/community?type=system&id=${data.system.id}`" class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white hover:border-ember/40">
              <ExternalLink class="h-4 w-4" />Ver post na comunidade
            </NuxtLink>
            <span v-if="data.system.featuredOnProfile" class="inline-flex items-center gap-2 rounded-lg border border-ember/30 bg-ember/10 px-3 py-2 text-sm font-bold text-ember">
              <Star class="h-4 w-4" />Destacado no perfil
            </span>
          </div>
        </div>
        <div class="flex gap-2">
          <AppButton v-if="!isOwner" variant="ghost" :loading="adding" :disabled="!canUseSystem" @click="addToInventory">
            <PlusCircle class="h-4 w-4" />Adicionar ao inventario
          </AppButton>
          <NuxtLink v-if="canUseSystem" :to="`/app/characters/new?systemId=${data.system.id}`"><AppButton><UserPlus class="h-4 w-4" />Criar personagem</AppButton></NuxtLink>
          <AppButton v-else disabled><UserPlus class="h-4 w-4" />Aguardando aprovacao</AppButton>
          <AppActionMenu v-if="isOwner" title="Acoes do sistema" :items="ownerActions()" @select="handleOwnerAction" />
          <AppActionMenu v-else title="Acoes do sistema" :items="visitorActions()" @select="handleVisitorAction" />
        </div>
        </div>
      </div>
    </AppCard>
    <AppCard>
      <h2 class="text-xl font-black text-white">Estrutura do sistema</h2>
      <SystemStructurePreview class="mt-4" :schema="data.system.schemaJson" :fields="data.system.fields as any" />
    </AppCard>
    <AppCard v-if="classes.length">
      <h2 class="text-xl font-black text-white">Classes</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div v-for="rpgClass in classes" :key="rpgClass.key" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <p class="font-black text-white">{{ rpgClass.name }}</p>
          <p class="mt-1 text-sm text-mist">{{ rpgClass.description || `${rpgClass.maxLevel} niveis configurados.` }}</p>
          <div class="mt-3 max-h-44 space-y-2 overflow-y-auto pr-2 text-sm">
            <div v-for="level in rpgClass.levels.filter((item) => item.changes.length)" :key="level.level" class="rounded border border-white/10 bg-panel/60 p-2">
              <b class="text-ember">Nivel {{ level.level }}</b>
              <p v-for="(change, index) in level.changes" :key="index" class="text-mist">
                {{ changeLine(change) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppCard>
    <AppCard>
      <h2 class="text-xl font-black text-white">Comentarios</h2>
      <div class="mt-4">
        <AppCommentThread
          :comments="data.system.comments || []"
          :endpoint="`/api/systems/${data.system.id}/comments`"
          :current-user-id="auth.user?.id"
          @refresh="refresh"
        />
      </div>
    </AppCard>
    <ConfirmModal
      :open="confirmDeleteOpen"
      title="Apagar sistema"
      :message="`Apagar ${data.system.name} remove o sistema do inventario e encerra salas ligadas a ele. Personagens existentes serao preservados com um snapshot do sistema.`"
      confirm-label="Apagar"
      :loading="deleting"
      @close="confirmDeleteOpen = false"
      @confirm="deleteSystem"
    />
    <ConfirmModal
      :open="publishOpen"
      title="Postar sistema"
      message="Uma copia das regras atuais sera enviada para analise da comunidade. Edicoes futuras criam nova versao/snapshot."
      confirm-label="Postar"
      :loading="publishing"
      @close="publishOpen = false"
      @confirm="publishSystem"
    />
  </div>
</template>

