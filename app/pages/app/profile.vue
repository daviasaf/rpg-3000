<script setup lang="ts">
import { Send } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const auth = useAuthStore()
const { push, apiError } = useToast()
const content = ref('')
const { data, refresh } = await useFetch<any>(() => `/api/social/profile/${auth.user?.id || ''}`, {
  default: () => ({ profile: auth.user, posts: [], profileComments: [], systems: [], npcs: [], characters: [], social: { isSelf: true } })
})

async function publish() {
  if (!content.value.trim()) return
  try {
    await $fetch('/api/social/profile/posts', { method: 'POST', body: { content: content.value } })
    content.value = ''
    await refresh()
    push('Post publicado.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel publicar.')
  }
}
</script>

<template>
  <div class="space-y-5">
    <SocialProfileView
      :profile="data.profile"
      :posts="data.posts"
      :profile-comments="data.profileComments"
      :systems="data.systems"
      :npcs="data.npcs"
      :characters="data.characters"
      own-profile
      @refresh="refresh"
    />
  </div>
</template>
