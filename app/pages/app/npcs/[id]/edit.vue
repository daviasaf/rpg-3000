<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const { data } = await useFetch<{ npc: {
  id: string
  name: string
  description?: string | null
  avatarUrl?: string | null
  systemId?: string | null
  isCommunity?: boolean
  moderationStatus?: string | null
  moderationReason?: string | null
  dataJson?: Record<string, unknown> | null
} }>(`/api/npcs/${route.params.id}`)
</script>

<template>
  <NpcForm v-if="data?.npc" mode="edit" :npc="data.npc" />
</template>

