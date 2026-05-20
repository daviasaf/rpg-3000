<script setup lang="ts">
import { BookOpen, Bot, ChevronDown, Heart, MessageCircle, PlusCircle, ScrollText } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

type CommunityPost = {
  id: string
  type: 'SYSTEM' | 'NPC' | 'CHARACTER'
  title: string
  description?: string | null
  avatarUrl?: string | null
  tags: string[]
  systemName?: string | null
  snapshotJson: Record<string, any>
  author?: { id: string; name: string; avatarUrl?: string | null; profileColor?: string | null } | null
  comments: Array<{ id: string; content: string; createdAt: string; updatedAt?: string; user?: { id: string; name: string; avatarUrl?: string | null; profileColor?: string | null } | null }>
  _count?: { likes: number; comments: number }
}

const route = useRoute()
const auth = useAuthStore()
const { push, apiError } = useToast()
const filter = ref<'ALL' | 'SYSTEM' | 'NPC' | 'CHARACTER'>(
  route.query.type === 'npc' ? 'NPC' : route.query.type === 'character' ? 'CHARACTER' : route.query.type === 'system' ? 'SYSTEM' : 'ALL'
)
const search = ref('')
const expanded = ref(new Set<string>())
const addingId = ref('')
const { data, refresh } = await useFetch<{ posts: CommunityPost[] }>('/api/community', { default: () => ({ posts: [] }) })

const visiblePosts = computed(() => {
  const q = search.value.trim().toLowerCase()
  return data.value.posts.filter((post) => {
    if (filter.value !== 'ALL' && post.type !== filter.value) return false
    const text = `${post.title} ${post.description || ''} ${post.systemName || ''} ${post.tags.join(' ')}`.toLowerCase()
    return !q || text.includes(q)
  })
})

function isOpen(id: string) {
  return expanded.value.has(id)
}

function toggle(id: string) {
  const next = new Set(expanded.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expanded.value = next
}

function typeLabel(type: CommunityPost['type']) {
  return ({ SYSTEM: 'Sistema', NPC: 'NPC', CHARACTER: 'Personagem' })[type]
}

function typeIcon(type: CommunityPost['type']) {
  return ({ SYSTEM: BookOpen, NPC: Bot, CHARACTER: ScrollText })[type]
}

async function like(id: string) {
  try {
    const response = await $fetch<{ liked: boolean }>(`/api/community/${id}/like`, { method: 'POST' })
    push(response.liked ? 'Curtida adicionada.' : 'Curtida removida.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel curtir.')
  }
}

async function clonePost(id: string, type: CommunityPost['type']) {
  addingId.value = id
  try {
    await $fetch(`/api/community/${id}/clone`, { method: 'POST' })
    push(type === 'SYSTEM' ? 'Sistema adicionado ao inventario.' : type === 'NPC' ? 'NPC adicionado ao inventario.' : 'Personagem copiado para suas fichas.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel adicionar.')
  } finally {
    addingId.value = ''
  }
}

</script>

<template>
  <div class="space-y-6">
    <AppPageHeader title="Comunidade" description="Conteudos publicados como copias independentes, com comentarios e curtidas." />

    <AppCard>
      <div class="grid gap-3 md:grid-cols-[220px_1fr]">
        <label><span class="label">Filtro</span><select v-model="filter" class="select"><option value="ALL">Tudo</option><option value="SYSTEM">Sistemas</option><option value="NPC">NPCs</option><option value="CHARACTER">Personagens</option></select></label>
        <label><span class="label">Pesquisar</span><input v-model="search" class="input" placeholder="Buscar por nome, tag, descricao..."></label>
      </div>
    </AppCard>

    <section class="space-y-4">
      <AppCard v-for="post in visiblePosts" :id="`post-${post.id}`" :key="post.id" class="transition hover:border-ember/30">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <button type="button" class="min-w-0 flex-1 text-left" @click="toggle(post.id)">
            <p class="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-ember">
              <component :is="typeIcon(post.type)" class="h-4 w-4" />{{ typeLabel(post.type) }}
            </p>
            <span class="mt-1 block text-xl font-black text-white hover:text-ember">{{ post.title }}</span>
            <p class="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-mist">{{ post.description || 'Sem descricao.' }}</p>
            <p class="mt-2 text-xs text-mist">{{ post.systemName || 'Generico' }} | por {{ post.author?.name || 'Usuario removido' }}</p>
          </button>
          <div class="flex flex-wrap items-start gap-2">
            <AppButton variant="ghost" :loading="addingId === post.id" @click="clonePost(post.id, post.type)">
              <PlusCircle class="h-4 w-4" />Adicionar
            </AppButton>
            <button type="button" class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-ember transition hover:bg-white/10" :title="isOpen(post.id) ? 'Minimizar' : 'Expandir'" @click="toggle(post.id)">
              <ChevronDown class="h-6 w-6 transition" :class="isOpen(post.id) ? 'rotate-180' : ''" />
            </button>
          </div>
        </div>

        <div v-if="isOpen(post.id)" class="mt-4 grid gap-3 md:grid-cols-[auto_1fr]">
          <AppAvatar :name="post.title" :src="post.avatarUrl" size="xl" />
          <div class="space-y-3">
            <p class="text-sm leading-6 text-mist">{{ post.description || 'Sem descricao.' }}</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="tag in post.tags" :key="tag" class="kbd-chip">{{ tag }}</span>
              <span v-if="post.type !== 'SYSTEM'" class="kbd-chip">{{ post.systemName || 'Generico' }}</span>
            </div>
            <div v-if="post.type === 'NPC' && Array.isArray(post.snapshotJson?.dataJson?.attacks)" class="flex flex-wrap gap-2">
              <span v-for="attack in post.snapshotJson.dataJson.attacks" :key="String(attack.name)" class="rounded-md border border-ember/25 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">{{ attack.name }}: {{ attack.damage }}</span>
            </div>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-bold text-white hover:border-ember/40" @click="like(post.id)">
            <Heart class="h-4 w-4" />{{ post._count?.likes || 0 }}
          </button>
          <button type="button" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-bold text-mist" @click="toggle(post.id)">
            <MessageCircle class="h-4 w-4" />{{ post._count?.comments || 0 }}
          </button>
        </div>

        <div v-if="isOpen(post.id)">
          <div class="mt-4">
            <AppCommentThread
              :comments="post.comments"
              :endpoint="`/api/community/${post.id}/comments`"
              :current-user-id="auth.user?.id"
              @refresh="refresh"
            />
          </div>
        </div>
      </AppCard>

      <EmptyState v-if="!visiblePosts.length" title="Nada publicado ainda" description="Quando a comunidade aprovar publicacoes, elas aparecem aqui." />
    </section>
  </div>
</template>
