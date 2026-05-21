<script setup lang="ts">
import { ArrowLeft, Edit3, ExternalLink, Heart, MessageCircle, PlusCircle, Settings, UserPlus } from 'lucide-vue-next'
import type { SystemSchema } from '../../../../../shared/types/system'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { push, apiError } = useToast()
const deleting = ref(false)
const adding = ref(false)
const settingsOpen = ref(false)
const confirmDeleteOpen = ref(false)
const comment = ref('')
const commenting = ref(false)
const { data, refresh } = await useFetch<{ system: {
  id: string
  name: string
  description: string
  tags: string[]
  visibility: string
  moderationStatus?: string
  moderationReason?: string | null
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
const classes = computed(() => data.value?.system.schemaJson?.classes || [])
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
  try {
    await $fetch(`/api/systems/${route.params.id}/like`, { method: 'POST' })
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel curtir o sistema.')
  }
}

async function addToInventory() {
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
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex flex-wrap gap-2">
            <span v-for="tag in data.system.tags" :key="tag" class="rounded-md border border-ember/25 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">{{ tag }}</span>
            <span v-if="data.system.moderationStatus" class="rounded-md border px-2 py-1 text-xs font-bold" :class="isRejected ? 'border-flare/35 bg-flare/10 text-red-100' : data.system.moderationStatus === 'PENDING' ? 'border-amber-300/30 bg-amber-300/10 text-amber-100' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'">
              {{ data.system.moderationStatus === 'PENDING' ? 'Em analise' : data.system.moderationStatus === 'REJECTED' ? 'Rejeitado' : 'Aprovado' }}
            </span>
          </div>
          <h1 class="mt-4 page-title">{{ data.system.name }}</h1>
          <p class="mt-2 max-w-3xl text-mist">{{ data.system.description }}</p>
          <p v-if="isRejected" class="mt-3 rounded-lg border border-flare/35 bg-flare/10 p-3 text-sm font-bold text-red-100">
            Este sistema foi rejeitado e esta bloqueado para edicao. {{ data.system.moderationReason ? `Motivo: ${data.system.moderationReason}` : 'Crie uma nova versao para enviar novamente.' }}
          </p>
          <p class="mt-3 text-sm text-mist">Criador: {{ data.system.createdBy?.name || 'Toca dos Nerds' }} | {{ data.system.visibility }}</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold" :class="liked ? 'border-ember bg-ember/15 text-ember' : 'border-white/10 bg-white/[0.04] text-white'" @click="toggleLike">
              <Heart class="h-4 w-4" />{{ data.system._count?.likes || 0 }}
            </button>
            <span class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-mist">
              <MessageCircle class="h-4 w-4" />{{ data.system._count?.comments || 0 }}
            </span>
            <NuxtLink :to="`/app/community?type=system&id=${data.system.id}`" class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white hover:border-ember/40">
              <ExternalLink class="h-4 w-4" />Ver post na comunidade
            </NuxtLink>
          </div>
        </div>
        <div class="flex gap-2">
          <AppButton v-if="!isOwner" variant="ghost" :loading="adding" @click="addToInventory">
            <PlusCircle class="h-4 w-4" />Adicionar ao inventario
          </AppButton>
          <NuxtLink :to="`/app/characters/new?systemId=${data.system.id}`"><AppButton><UserPlus class="h-4 w-4" />Criar personagem</AppButton></NuxtLink>
          <div v-if="isOwner" class="relative">
            <button type="button" class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-mist hover:text-white" @click="settingsOpen = !settingsOpen">
              <Settings class="h-5 w-5" />
            </button>
            <div v-if="settingsOpen" class="absolute right-0 top-12 z-10 w-44 rounded-lg border border-white/10 bg-panel p-1 shadow-soft">
              <NuxtLink v-if="!isRejected" :to="`/app/systems/${data.system.id}/edit`" class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-white hover:bg-white/10"><Edit3 class="h-4 w-4" />Editar</NuxtLink>
              <button type="button" class="block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-red-100 hover:bg-flare/15" @click="confirmDeleteOpen = true; settingsOpen = false">Apagar</button>
            </div>
          </div>
        </div>
      </div>
    </AppCard>
    <AppCard v-for="group in fieldGroups" :key="group.category">
      <h2 class="text-xl font-black text-white">{{ categoryLabel(group.category) }}</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="field in group.fields" :key="field.id" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <h3 class="text-lg font-black text-white">{{ field.label }}</h3>
          <p class="mt-1 text-sm text-mist">Chave: {{ field.key }} | Tipo: {{ field.type }}</p>
          <p v-if="field.formula" class="mt-2 rounded-lg bg-white/[0.05] p-2 text-sm text-arcane">{{ field.formula }}</p>
        </div>
      </div>
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
                {{ change.operation === 'ADD' ? '+' : '=' }}{{ change.value }} em {{ change.targetLabel || change.targetKey }}{{ change.note ? ` - ${change.note}` : '' }}
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
      :message="`Apagar ${data.system.name} tambem remove personagens e salas ligados a ele.`"
      confirm-label="Apagar"
      :loading="deleting"
      @close="confirmDeleteOpen = false"
      @confirm="deleteSystem"
    />
  </div>
</template>
