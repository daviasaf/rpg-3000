<script setup lang="ts">
import { Heart, MessageCircle, Send } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

type SocialUser = { id: string; name: string; username?: string | null; avatarUrl?: string | null; profileColor?: string | null }
type ProfilePost = {
  id: string
  content: string
  createdAt: string
  user: SocialUser
  comments: Array<{ id: string; content: string; createdAt: string; user?: SocialUser | null }>
  _count?: { likes: number; comments: number }
}

const route = useRoute()
const comments = reactive<Record<string, string>>({})
const expanded = ref(new Set<string>())
const { data, refresh } = await useFetch<{ profile: SocialUser; posts: ProfilePost[] }>(`/api/social/profile/${route.params.id}`, { default: () => ({ profile: {} as SocialUser, posts: [] }) })

function isOpen(id: string) {
  return expanded.value.has(id)
}

function toggle(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

async function like(postId: string) {
  await $fetch(`/api/social/profile/posts/${postId}/like`, { method: 'POST' })
  await refresh()
}

async function comment(postId: string) {
  const text = comments[postId]?.trim()
  if (!text) return
  await $fetch(`/api/social/profile/posts/${postId}/comments`, { method: 'POST', body: { content: text } })
  comments[postId] = ''
  await refresh()
}
</script>

<template>
  <div class="space-y-5">
    <AppCard>
      <div class="flex flex-wrap items-center gap-4">
        <AppAvatar :name="data.profile?.name" :src="data.profile?.avatarUrl" :color="data.profile?.profileColor" size="xl" rounded="full" />
        <div class="min-w-0">
          <h1 class="page-title">{{ data.profile?.name }}</h1>
          <p class="text-mist">@{{ data.profile?.username || 'sem-usuario' }}</p>
        </div>
      </div>
    </AppCard>

    <article v-for="post in data.posts" :key="post.id" class="surface rounded-lg p-4">
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
        <form class="mt-4 flex gap-2" @submit.prevent="comment(post.id)">
          <input v-model="comments[post.id]" class="input" placeholder="Comentar...">
          <AppButton type="submit"><Send class="h-4 w-4" />Enviar</AppButton>
        </form>
        <div class="mt-3 space-y-2" :class="post.comments.length > 5 ? 'max-h-80 overflow-y-auto pr-2' : ''">
          <div v-for="item in post.comments" :key="item.id" class="soft-row flex gap-3 p-3">
            <AppAvatar :name="item.user?.name" :src="item.user?.avatarUrl" :color="item.user?.profileColor" rounded="full" size="sm" />
            <p class="text-sm text-mist"><b class="text-white">{{ item.user?.name }}</b> {{ item.content }}</p>
          </div>
        </div>
      </div>
    </article>

    <EmptyState v-if="!data.posts.length" title="Nenhum post publico" description="Este usuario ainda nao publicou no perfil." />
  </div>
</template>
