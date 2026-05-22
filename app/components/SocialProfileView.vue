<script setup lang="ts">
type SocialUser = { id: string; name: string; username?: string | null; avatarUrl?: string | null; profileColor?: string | null }
type ProfilePost = {
  id: string
  content: string
  createdAt: string
  comments: Array<{ id: string; content: string; createdAt: string; updatedAt?: string; user?: SocialUser | null }>
  _count?: { likes: number; comments: number }
}
type CreatedItem = { id: string; name: string; description?: string | null; avatarUrl?: string | null; moderationStatus?: string; hasNewVersion?: boolean; system?: { name: string } | null }
type CommentItem = { id: string; content: string; createdAt: string; updatedAt?: string | null; user?: SocialUser | null }

const props = defineProps<{
  profile: SocialUser
  posts: ProfilePost[]
  profileComments?: CommentItem[]
  systems?: CreatedItem[]
  npcs?: CreatedItem[]
  characters?: CreatedItem[]
  profileLikes?: { count: number; likedByMe: boolean }
  likeLoading?: boolean
  ownProfile?: boolean
}>()
const emit = defineEmits<{ refresh: [], toggleProfileLike: [] }>()
const auth = useAuthStore()

const publicItems = computed(() => [
  ...(props.systems || []),
  ...(props.npcs || []),
  ...(props.characters || [])
])
const likesCount = computed(() => props.profileLikes?.count || 0)

function profileHandle(profile?: SocialUser) {
  return profile?.username ? `@${profile.username}` : 'usuario sem identificador publico'
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
          <button
            v-if="!ownProfile"
            type="button"
            class="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
            :class="profileLikes?.likedByMe ? 'border-ember bg-ember/15 text-ember' : 'border-white/10 bg-white/[0.04] text-white hover:border-ember/40'"
            :disabled="likeLoading"
            @click="emit('toggleProfileLike')"
          >
            <span v-if="likeLoading" class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span v-else>♥</span>
            {{ likesCount }}
          </button>
          <span v-else class="kbd-chip">{{ likesCount }} curtidas</span>
          <span class="kbd-chip">{{ publicItems.length }} criacoes</span>
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
            <span class="min-w-0"><b class="block truncate text-white">{{ item.name }}</b><span class="line-clamp-1 text-xs text-mist">{{ item.description || 'Sem descricao.' }}</span><span v-if="item.hasNewVersion" class="mt-1 inline-flex rounded border border-ember/30 bg-ember/10 px-1.5 py-0.5 text-[10px] font-black text-ember">Nova versao disponivel</span></span>
          </NuxtLink>
          <p v-if="!systems?.length" class="text-sm text-mist">Nenhum sistema destacado.</p>
        </div>
      </AppCard>
      <AppCard>
        <h2 class="font-black text-white">NPCs</h2>
        <div class="mt-3 space-y-2">
          <NuxtLink v-for="item in npcs" :key="item.id" :to="`/app/npcs/${item.id}`" class="soft-row flex items-center gap-3 p-3">
            <AppAvatar :name="item.name" :src="item.avatarUrl" size="sm" />
            <span class="min-w-0"><b class="block truncate text-white">{{ item.name }}</b><span class="line-clamp-1 text-xs text-mist">{{ item.description || 'Sem descricao.' }}</span><span v-if="item.hasNewVersion" class="mt-1 inline-flex rounded border border-ember/30 bg-ember/10 px-1.5 py-0.5 text-[10px] font-black text-ember">Nova versao disponivel</span></span>
          </NuxtLink>
          <p v-if="!npcs?.length" class="text-sm text-mist">Nenhum NPC destacado.</p>
        </div>
      </AppCard>
      <AppCard>
        <h2 class="font-black text-white">Personagens</h2>
        <div class="mt-3 space-y-2">
          <NuxtLink v-for="item in characters" :key="item.id" :to="`/app/characters/${item.id}`" class="soft-row flex items-center gap-3 p-3">
            <AppAvatar :name="item.name" :src="item.avatarUrl" size="sm" />
            <span class="min-w-0"><b class="block truncate text-white">{{ item.name }}</b><span class="line-clamp-1 text-xs text-mist">{{ item.system?.name || item.description || 'Sem sistema.' }}</span><span v-if="item.hasNewVersion" class="mt-1 inline-flex rounded border border-ember/30 bg-ember/10 px-1.5 py-0.5 text-[10px] font-black text-ember">Nova versao disponivel</span></span>
          </NuxtLink>
          <p v-if="!characters?.length" class="text-sm text-mist">Nenhum personagem destacado.</p>
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
          :can-create="!ownProfile"
          placeholder="Comentar neste perfil..."
          :empty-text="ownProfile ? 'Nenhum comentario recebido no seu perfil ainda.' : 'Nenhum comentario publico neste perfil ainda.'"
          @refresh="emit('refresh')"
        />
      </div>
    </AppCard>
  </div>
</template>

