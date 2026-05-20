<script setup lang="ts">
import { Bot, BookOpen, ChevronDown, Heart, MessageCircle, MoreHorizontal, PlusCircle } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

type CommentItem = {
  id: string
  content: string
  createdAt: string
  updatedAt?: string
  userId?: string
  user?: { id: string; name: string; avatarUrl?: string | null; profileColor?: string | null } | null
}

const route = useRoute()
const auth = useAuthStore()
const { push, apiError } = useToast()
const filter = ref<'ALL' | 'SYSTEM' | 'NPC'>(route.query.type === 'npc' ? 'NPC' : route.query.type === 'system' ? 'SYSTEM' : 'ALL')
const search = ref('')
const systemComment = reactive<Record<string, string>>({})
const npcComment = reactive<Record<string, string>>({})
const editingComment = ref<{ kind: 'system' | 'npc'; parentId: string; id: string; content: string } | null>(null)
const deleteTarget = ref<{ type: 'system' | 'npc'; id: string; name: string } | null>(null)
const deleting = ref(false)
const addingId = ref('')
const postMenu = ref('')
const commentMenu = ref('')
const expandedPosts = ref(new Set<string>())

const [{ data: systems, refresh: refreshSystems }, { data: npcs, refresh: refreshNpcs }] = await Promise.all([
  useFetch<{ systems: Array<{
    id: string
    name: string
    description: string
    tags: string[]
    createdById?: string | null
    createdBy?: { id: string; name: string; avatarUrl?: string | null; profileColor?: string | null } | null
    likes?: Array<{ id: string }>
    comments?: CommentItem[]
    _count?: { likes: number; comments: number; characters: number; rooms: number }
  }> }>('/api/systems?community=true'),
  useFetch<{ npcs: Array<{
    id: string
    name: string
    description?: string | null
    isCommunity: boolean
    system?: { name: string } | null
    createdById?: string | null
    createdBy?: { id: string; name: string; avatarUrl?: string | null; profileColor?: string | null } | null
    dataJson: Record<string, unknown>
    likes?: Array<{ id: string }>
    comments?: CommentItem[]
    _count?: { likes: number; comments: number }
  }> }>('/api/npcs?community=true')
])

const normalizedSearch = computed(() => search.value.trim().toLowerCase())
const visibleSystems = computed(() => {
  if (filter.value === 'NPC') return []
  return (systems.value?.systems || []).filter((system) => {
    const text = `${system.name} ${system.description} ${system.tags.join(' ')}`.toLowerCase()
    return !normalizedSearch.value || text.includes(normalizedSearch.value)
  })
})
const visibleNpcs = computed(() => {
  if (filter.value === 'SYSTEM') return []
  return (npcs.value?.npcs || []).filter((npc) => {
    if (!npc.isCommunity) return false
    const text = `${npc.name} ${npc.description || ''} ${npc.system?.name || ''}`.toLowerCase()
    return !normalizedSearch.value || text.includes(normalizedSearch.value)
  })
})

onMounted(async () => {
  await nextTick()
  const id = typeof route.query.id === 'string' ? route.query.id : ''
  if (id) document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

async function likeSystem(id: string) {
  try {
    await $fetch(`/api/systems/${id}/like`, { method: 'POST' })
    await refreshSystems()
  } catch (error) {
    apiError(error, 'Nao foi possivel curtir o sistema.')
  }
}

async function addSystemToInventory(id: string) {
  addingId.value = `system:${id}`
  try {
    await $fetch(`/api/systems/${id}/clone`, { method: 'POST' })
    push('Sistema adicionado ao seu inventario.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel adicionar o sistema.')
  } finally {
    addingId.value = ''
  }
}

async function commentSystem(id: string) {
  const content = systemComment[id]?.trim()
  if (!content) return
  try {
    await $fetch(`/api/systems/${id}/comments`, { method: 'POST', body: { content } })
    systemComment[id] = ''
    await refreshSystems()
  } catch (error) {
    apiError(error, 'Nao foi possivel comentar no sistema.')
  }
}

async function likeNpc(id: string) {
  try {
    await $fetch(`/api/npcs/${id}/like`, { method: 'POST' })
    await refreshNpcs()
  } catch (error) {
    apiError(error, 'Nao foi possivel curtir o NPC.')
  }
}

async function addNpcToInventory(id: string) {
  addingId.value = `npc:${id}`
  try {
    await $fetch(`/api/npcs/${id}/clone`, { method: 'POST' })
    push('NPC adicionado ao seu inventario.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel adicionar o NPC.')
  } finally {
    addingId.value = ''
  }
}

async function commentNpc(id: string) {
  const content = npcComment[id]?.trim()
  if (!content) return
  try {
    await $fetch(`/api/npcs/${id}/comments`, { method: 'POST', body: { content } })
    npcComment[id] = ''
    await refreshNpcs()
  } catch (error) {
    apiError(error, 'Nao foi possivel comentar no NPC.')
  }
}

async function saveComment() {
  if (!editingComment.value?.content.trim()) return
  const item = editingComment.value
  try {
    await $fetch(`/api/${item.kind === 'system' ? 'systems' : 'npcs'}/${item.parentId}/comments/${item.id}`, {
      method: 'PUT',
      body: { content: item.content }
    })
    editingComment.value = null
    await Promise.all([refreshSystems(), refreshNpcs()])
  } catch (error) {
    apiError(error, 'Nao foi possivel editar o comentario.')
  }
}

async function deleteComment(kind: 'system' | 'npc', parentId: string, id: string) {
  try {
    await $fetch(`/api/${kind === 'system' ? 'systems' : 'npcs'}/${parentId}/comments/${id}`, { method: 'DELETE' })
    await Promise.all([refreshSystems(), refreshNpcs()])
  } catch (error) {
    apiError(error, 'Nao foi possivel apagar o comentario.')
  }
}

async function deletePost() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await $fetch(`/api/${deleteTarget.value.type === 'system' ? 'systems' : 'npcs'}/${deleteTarget.value.id}`, { method: 'DELETE' })
    push(deleteTarget.value.type === 'system' ? 'Sistema apagado.' : 'NPC apagado.', 'success')
    deleteTarget.value = null
    await Promise.all([refreshSystems(), refreshNpcs()])
  } catch (error) {
    apiError(error, 'Nao foi possivel apagar.')
  } finally {
    deleting.value = false
  }
}

function avatarLabel(name?: string) {
  return (name || '?').slice(0, 1).toUpperCase()
}

function userColor(user?: { profileColor?: string | null } | null) {
  return user?.profileColor || '#ff8a13'
}

function wasEdited(comment: CommentItem) {
  return comment.updatedAt && new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000
}

function commentMenuKey(kind: 'system' | 'npc', id: string) {
  return `${kind}:${id}`
}

function postKey(kind: 'system' | 'npc', id: string) {
  return `${kind}:${id}`
}

function isExpanded(kind: 'system' | 'npc', id: string) {
  return expandedPosts.value.has(postKey(kind, id))
}

function togglePost(kind: 'system' | 'npc', id: string) {
  const key = postKey(kind, id)
  const next = new Set(expandedPosts.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedPosts.value = next
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="page-title">Comunidade</h1>
      <p class="muted mt-1">Sistemas e NPCs compartilhados como posts, com comentarios e curtidas.</p>
    </div>

    <AppCard>
      <div class="grid gap-3 md:grid-cols-[220px_1fr]">
        <label>
          <span class="label">Filtro</span>
          <select v-model="filter" class="select">
            <option value="ALL">Tudo</option>
            <option value="SYSTEM">Sistemas</option>
            <option value="NPC">NPCs</option>
          </select>
        </label>
        <label>
          <span class="label">Pesquisar</span>
          <input v-model="search" class="input" placeholder="Buscar por nome, tag, descricao...">
        </label>
      </div>
    </AppCard>

    <section v-if="filter !== 'NPC'" class="space-y-4">
      <h2 class="flex items-center gap-2 text-xl font-black text-white"><BookOpen class="h-5 w-5 text-ember" />Sistemas</h2>
      <AppCard v-for="system in visibleSystems" :id="`post-${system.id}`" :key="system.id" class="transition hover:border-ember/30">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <button type="button" class="min-w-0 flex-1 text-left" @click="togglePost('system', system.id)">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-ember">Sistema</p>
            <span class="mt-1 block text-xl font-black text-white hover:text-ember">{{ system.name }}</span>
            <p class="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-mist">{{ system.description }}</p>
            <p class="mt-2 text-xs text-mist">por {{ system.createdBy?.name || 'Central RPG' }}</p>
          </button>
          <div class="flex flex-wrap items-start gap-2">
            <NuxtLink :to="`/app/systems/${system.id}`"><AppButton variant="ghost">Ver completo</AppButton></NuxtLink>
            <AppButton v-if="system.createdById !== auth.user?.id" variant="ghost" :loading="addingId === `system:${system.id}`" @click="addSystemToInventory(system.id)">
              <PlusCircle class="h-4 w-4" />Adicionar ao inventario
            </AppButton>
            <div v-if="system.createdById === auth.user?.id" class="relative">
              <button type="button" class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-mist hover:text-white" title="Opcoes" @click="postMenu = postMenu === `system:${system.id}` ? '' : `system:${system.id}`">
                <MoreHorizontal class="h-5 w-5" />
              </button>
              <div v-if="postMenu === `system:${system.id}`" class="absolute right-0 top-12 z-10 w-40 rounded-lg border border-white/10 bg-panel p-1 shadow-soft">
                <NuxtLink :to="`/app/systems/${system.id}/edit`" class="block rounded-md px-3 py-2 text-sm font-bold text-white hover:bg-white/10" @click="postMenu = ''">Editar</NuxtLink>
                <button type="button" class="block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-red-100 hover:bg-flare/15" @click="deleteTarget = { type: 'system', id: system.id, name: system.name }; postMenu = ''">Apagar</button>
              </div>
            </div>
            <button type="button" class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-ember transition hover:bg-white/10" :title="isExpanded('system', system.id) ? 'Minimizar' : 'Expandir'" @click="togglePost('system', system.id)">
              <ChevronDown class="h-6 w-6 transition" :class="isExpanded('system', system.id) ? 'rotate-180' : ''" />
            </button>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-white hover:border-ember/40" @click="likeSystem(system.id)">
            <Heart class="h-4 w-4" />{{ system._count?.likes || 0 }}
          </button>
          <span class="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-mist">
            <MessageCircle class="h-4 w-4" />{{ system._count?.comments || 0 }}
          </span>
        </div>
        <div v-if="isExpanded('system', system.id)">
          <form class="mt-4 flex gap-2" @submit.prevent="commentSystem(system.id)">
            <input v-model="systemComment[system.id]" class="input" placeholder="Comentar...">
            <AppButton type="submit">Enviar</AppButton>
          </form>
        <div class="mt-3 space-y-2" :class="(system.comments?.length || 0) > 5 ? 'max-h-80 overflow-y-auto pr-2' : ''">
          <div v-for="item in system.comments" :key="item.id" class="relative flex gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 pr-12 text-sm text-mist">
            <AppAvatar :name="item.user?.name" :src="item.user?.avatarUrl" :color="userColor(item.user)" rounded="full" size="sm" />
            <div class="min-w-0 flex-1">
              <p><b class="text-white">{{ item.user?.name || 'Jogador' }}</b> <span class="text-xs">{{ new Date(item.createdAt).toLocaleString('pt-BR') }}{{ wasEdited(item) ? ' | editado' : '' }}</span></p>
              <textarea v-if="editingComment?.id === item.id" v-model="editingComment.content" rows="2" class="input mt-2" />
              <p v-else class="mt-1 break-words">{{ item.content }}</p>
              <div v-if="item.user?.id === auth.user?.id" class="absolute right-3 top-3">
                <button v-if="editingComment?.id === item.id" type="button" class="text-xs font-bold text-ember" @click="saveComment">Salvar</button>
                <div class="relative">
                  <button type="button" class="rounded-md p-1 text-mist hover:bg-white/10 hover:text-white" title="Opcoes do comentario" @click="commentMenu = commentMenu === commentMenuKey('system', item.id) ? '' : commentMenuKey('system', item.id)">
                    <MoreHorizontal class="h-4 w-4" />
                  </button>
                  <div v-if="commentMenu === commentMenuKey('system', item.id)" class="absolute left-0 top-7 z-10 w-32 rounded-lg border border-white/10 bg-panel p-1 shadow-soft">
                    <button v-if="editingComment?.id !== item.id" type="button" class="block w-full rounded-md px-3 py-2 text-left text-xs font-bold text-white hover:bg-white/10" @click="editingComment = { kind: 'system', parentId: system.id, id: item.id, content: item.content }; commentMenu = ''">Editar</button>
                    <button type="button" class="block w-full rounded-md px-3 py-2 text-left text-xs font-bold text-red-100 hover:bg-flare/15" @click="deleteComment('system', system.id, item.id); commentMenu = ''">Apagar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </AppCard>
    </section>

    <section v-if="filter !== 'SYSTEM'" class="space-y-4">
      <h2 class="flex items-center gap-2 text-xl font-black text-white"><Bot class="h-5 w-5 text-ember" />NPCs</h2>
      <AppCard v-for="npc in visibleNpcs" :id="`post-${npc.id}`" :key="npc.id" class="transition hover:border-ember/30">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <button type="button" class="min-w-0 flex-1 text-left" @click="togglePost('npc', npc.id)">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-ember">NPC</p>
            <span class="mt-1 block text-xl font-black text-white hover:text-ember">{{ npc.name }}</span>
            <p class="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-mist">{{ npc.description || 'Sem descricao.' }}</p>
            <p class="mt-2 text-xs text-mist">{{ npc.system?.name || 'Generico' }} | por {{ npc.createdBy?.name || 'Jogador' }}</p>
          </button>
          <div class="flex flex-wrap items-start gap-2">
            <NuxtLink :to="`/app/npcs/${npc.id}`"><AppButton variant="ghost">Ver completo</AppButton></NuxtLink>
            <AppButton v-if="npc.createdById !== auth.user?.id" variant="ghost" :loading="addingId === `npc:${npc.id}`" @click="addNpcToInventory(npc.id)">
              <PlusCircle class="h-4 w-4" />Adicionar ao inventario
            </AppButton>
            <div v-if="npc.createdById === auth.user?.id" class="relative">
              <button type="button" class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-mist hover:text-white" title="Opcoes" @click="postMenu = postMenu === `npc:${npc.id}` ? '' : `npc:${npc.id}`">
                <MoreHorizontal class="h-5 w-5" />
              </button>
              <div v-if="postMenu === `npc:${npc.id}`" class="absolute right-0 top-12 z-10 w-40 rounded-lg border border-white/10 bg-panel p-1 shadow-soft">
                <NuxtLink to="/app/npcs" class="block rounded-md px-3 py-2 text-sm font-bold text-white hover:bg-white/10" @click="postMenu = ''">Editar</NuxtLink>
                <button type="button" class="block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-red-100 hover:bg-flare/15" @click="deleteTarget = { type: 'npc', id: npc.id, name: npc.name }; postMenu = ''">Apagar</button>
              </div>
            </div>
            <button type="button" class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-ember transition hover:bg-white/10" :title="isExpanded('npc', npc.id) ? 'Minimizar' : 'Expandir'" @click="togglePost('npc', npc.id)">
              <ChevronDown class="h-6 w-6 transition" :class="isExpanded('npc', npc.id) ? 'rotate-180' : ''" />
            </button>
          </div>
        </div>
        <div v-if="isExpanded('npc', npc.id) && Array.isArray(npc.dataJson.attacks)" class="mt-3 flex flex-wrap gap-2">
          <span v-for="attack in npc.dataJson.attacks" :key="String((attack as Record<string, unknown>).name)" class="rounded-md border border-ember/25 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">
            {{ (attack as Record<string, unknown>).name }}: {{ (attack as Record<string, unknown>).damage }}
          </span>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-white hover:border-ember/40" @click="likeNpc(npc.id)">
            <Heart class="h-4 w-4" />{{ npc._count?.likes || 0 }}
          </button>
          <span class="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-mist">
            <MessageCircle class="h-4 w-4" />{{ npc._count?.comments || 0 }}
          </span>
        </div>
        <div v-if="isExpanded('npc', npc.id)">
        <form class="mt-4 flex gap-2" @submit.prevent="commentNpc(npc.id)">
            <input v-model="npcComment[npc.id]" class="input" placeholder="Comentar...">
            <AppButton type="submit">Enviar</AppButton>
          </form>
        <div class="mt-3 space-y-2" :class="(npc.comments?.length || 0) > 5 ? 'max-h-80 overflow-y-auto pr-2' : ''">
          <div v-for="item in npc.comments" :key="item.id" class="relative flex gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 pr-12 text-sm text-mist">
            <AppAvatar :name="item.user?.name" :src="item.user?.avatarUrl" :color="userColor(item.user)" rounded="full" size="sm" />
            <div class="min-w-0 flex-1">
              <p><b class="text-white">{{ item.user?.name || 'Jogador' }}</b> <span class="text-xs">{{ new Date(item.createdAt).toLocaleString('pt-BR') }}{{ wasEdited(item) ? ' | editado' : '' }}</span></p>
              <textarea v-if="editingComment?.id === item.id" v-model="editingComment.content" rows="2" class="input mt-2" />
              <p v-else class="mt-1 break-words">{{ item.content }}</p>
              <div v-if="item.user?.id === auth.user?.id" class="absolute right-3 top-3">
                <button v-if="editingComment?.id === item.id" type="button" class="text-xs font-bold text-ember" @click="saveComment">Salvar</button>
                <div class="relative">
                  <button type="button" class="rounded-md p-1 text-mist hover:bg-white/10 hover:text-white" title="Opcoes do comentario" @click="commentMenu = commentMenu === commentMenuKey('npc', item.id) ? '' : commentMenuKey('npc', item.id)">
                    <MoreHorizontal class="h-4 w-4" />
                  </button>
                  <div v-if="commentMenu === commentMenuKey('npc', item.id)" class="absolute left-0 top-7 z-10 w-32 rounded-lg border border-white/10 bg-panel p-1 shadow-soft">
                    <button v-if="editingComment?.id !== item.id" type="button" class="block w-full rounded-md px-3 py-2 text-left text-xs font-bold text-white hover:bg-white/10" @click="editingComment = { kind: 'npc', parentId: npc.id, id: item.id, content: item.content }; commentMenu = ''">Editar</button>
                    <button type="button" class="block w-full rounded-md px-3 py-2 text-left text-xs font-bold text-red-100 hover:bg-flare/15" @click="deleteComment('npc', npc.id, item.id); commentMenu = ''">Apagar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </AppCard>
    </section>

    <ConfirmModal
      :open="Boolean(deleteTarget)"
      title="Apagar publicacao"
      :message="`Apagar ${deleteTarget?.name || 'este item'}?`"
      confirm-label="Apagar"
      :loading="deleting"
      @close="deleteTarget = null"
      @confirm="deletePost"
    />
  </div>
</template>
