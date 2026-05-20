<script setup lang="ts">
import { Heart, MessageCircle } from 'lucide-vue-next'

type SocialUser = { id: string; name: string; username?: string | null; avatarUrl?: string | null; profileColor?: string | null }
type ProfilePost = {
  id: string
  content: string
  createdAt: string
  comments: Array<{ id: string; content: string; createdAt: string; updatedAt?: string; user?: SocialUser | null }>
  _count?: { likes: number; comments: number }
}
type CreatedItem = { id: string; name: string; description?: string | null; avatarUrl?: string | null; moderationStatus?: string; system?: { name: string } | null }
type CommentItem = { id: string; content: string; createdAt: string; updatedAt?: string | null; user?: SocialUser | null }

const props = defineProps<{
  profile: SocialUser
  posts: ProfilePost[]
  profileComments?: CommentItem[]
  systems?: CreatedItem[]
  npcs?: CreatedItem[]
  characters?: CreatedItem[]
  ownProfile?: boolean
}>()
const emit = defineEmits<{ refresh: [] }>()
const { push, apiError } = useToast()
const auth = useAuthStore()
const expanded = ref(new Set<string>())

const publicItems = computed(() => [
  ...(props.systems || []),
  ...(props.npcs || []),
  ...(props.characters || [])
])

function profileHandle(profile?: SocialUser) {
  return profile?.username ? `@${profile.username}` : 'usuario sem identificador publico'
}

function isOpen(id: string) {
  return expanded.value.has(id)
}

function toggle(id: string) {
  const next = new Set(expanded.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expanded.value = next
}

async function like(postId: string) {
  try {
    const response = await $fetch<{ liked: boolean }>(`/api/social/profile/posts/${postId}/like`, { method: 'POST' })
    push(response.liked ? 'Curtida adicionada.' : 'Curtida removida.', 'success')
    emit('refresh')
  } catch (error) {
    apiError(error, 'Erro ao curtir.')
  }
}

</script>

<template>
  <div class="space-y-5">
    <AppCard>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-4">
        <AppAvatar :name="profile?.name" :src="profile?.avatarUrl" :color="profile?.profileColor" size="xl" rounded="full" />
        <div class="min-w-0">
          <h1 class="page-title">{{ profile?.name || 'Usuario removido' }}</h1>
          <p class="text-mist">{{ profileHandle(profile) }}</p>
          <p class="mt-2 text-sm text-mist">{{ publicItems.length }} conteudos publicos no perfil</p>
        </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="kbd-chip">{{ posts.length }} posts</span>
          <span class="kbd-chip">{{ profileComments?.length || 0 }} comentarios</span>
        </div>
      </div>
    </AppCard>

    <section class="grid gap-4 md:grid-cols-3">
      <AppCard>
        <h2 class="font-black text-white">Sistemas</h2>
        <div class="mt-3 space-y-2">
          <NuxtLink v-for="item in systems" :key="item.id" :to="`/app/systems/${item.id}`" class="soft-row flex items-center gap-3 p-3">
            <AppAvatar :name="item.name" :src="item.avatarUrl" size="sm" />
            <span class="min-w-0"><b class="block truncate text-white">{{ item.name }}</b><span class="line-clamp-1 text-xs text-mist">{{ item.description || 'Sem descricao.' }}</span></span>
          </NuxtLink>
          <p v-if="!systems?.length" class="text-sm text-mist">Nenhum sistema criado.</p>
        </div>
      </AppCard>
      <AppCard>
        <h2 class="font-black text-white">NPCs</h2>
        <div class="mt-3 space-y-2">
          <NuxtLink v-for="item in npcs" :key="item.id" :to="`/app/npcs/${item.id}`" class="soft-row flex items-center gap-3 p-3">
            <AppAvatar :name="item.name" :src="item.avatarUrl" size="sm" />
            <span class="min-w-0"><b class="block truncate text-white">{{ item.name }}</b><span class="line-clamp-1 text-xs text-mist">{{ item.description || 'Sem descricao.' }}</span></span>
          </NuxtLink>
          <p v-if="!npcs?.length" class="text-sm text-mist">Nenhum NPC criado.</p>
        </div>
      </AppCard>
      <AppCard>
        <h2 class="font-black text-white">Personagens</h2>
        <div class="mt-3 space-y-2">
          <NuxtLink v-for="item in characters" :key="item.id" :to="`/app/characters/${item.id}`" class="soft-row flex items-center gap-3 p-3">
            <AppAvatar :name="item.name" :src="item.avatarUrl" size="sm" />
            <span class="min-w-0"><b class="block truncate text-white">{{ item.name }}</b><span class="line-clamp-1 text-xs text-mist">{{ item.system?.name || item.description || 'Sem sistema.' }}</span></span>
          </NuxtLink>
          <p v-if="!characters?.length" class="text-sm text-mist">Nenhum personagem criado.</p>
        </div>
      </AppCard>
    </section>

    <AppCard>
      <h2 class="text-xl font-black text-white">Comentarios do perfil</h2>
      <p class="mt-1 text-sm text-mist">Comentarios publicos deixados por outras pessoas neste perfil.</p>
      <div class="mt-4">
        <AppCommentThread
          :comments="profileComments || []"
          :endpoint="`/api/social/profile/${profile.id}/comments`"
          :current-user-id="auth.user?.id"
          :can-delete-all="ownProfile"
          placeholder="Comentar neste perfil..."
          empty-text="Nenhum comentario publico neste perfil ainda."
          @refresh="emit('refresh')"
        />
      </div>
    </AppCard>

    <article v-for="post in posts" :key="post.id" class="surface rounded-lg p-4">
      <button type="button" class="w-full text-left" @click="toggle(post.id)">
        <p class="whitespace-pre-wrap text-sm leading-6 text-white" :class="isOpen(post.id) ? '' : 'line-clamp-2'">{{ post.content }}</p>
        <p class="mt-2 text-xs text-mist">{{ new Date(post.createdAt).toLocaleString('pt-BR') }}</p>
      </button>
      <div class="mt-3 flex gap-2">
        <button class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-bold text-white hover:border-ember/40" @click="like(post.id)">
          <Heart class="h-4 w-4" />{{ post._count?.likes || 0 }}
        </button>
        <button class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-bold text-mist" @click="toggle(post.id)">
          <MessageCircle class="h-4 w-4" />{{ post._count?.comments || 0 }}
        </button>
      </div>
      <div v-if="isOpen(post.id)">
        <div class="mt-4">
          <AppCommentThread
            :comments="post.comments"
            :endpoint="`/api/social/profile/posts/${post.id}/comments`"
            :current-user-id="auth.user?.id"
            :can-delete-all="ownProfile"
            @refresh="emit('refresh')"
          />
        </div>
      </div>
    </article>

    <EmptyState v-if="!posts.length" title="Nenhum post publico" description="As postagens publicas aparecem aqui." />
  </div>
</template>
