<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

const auth = useAuthStore()
const { data, refresh } = await useFetch<any>(() => `/api/social/profile/${auth.user?.id || ''}`, {
  default: () => ({ profile: auth.user, posts: [], profileComments: [], systems: [], npcs: [], characters: [], profileLikes: { count: 0, likedByMe: false }, social: { isSelf: true } })
})
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
      :profile-likes="data.profileLikes"
      own-profile
      @refresh="refresh"
    />
  </div>
</template>

