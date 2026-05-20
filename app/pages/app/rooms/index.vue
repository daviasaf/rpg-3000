<script setup lang="ts">
import { LogIn, Plus } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { data } = await useFetch<{ rooms: Array<{
  id: string
  name: string
  description?: string | null
  code: string
  system?: { name: string }
  master?: { name: string }
  _count?: { members: number }
}> }>('/api/rooms')
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="page-title">Minhas salas</h1>
        <p class="muted mt-1">Campanhas, convites e sessoes ativas.</p>
      </div>
      <div class="flex gap-2">
        <NuxtLink to="/app/rooms/join"><AppButton variant="ghost"><LogIn class="h-4 w-4" />Entrar por codigo</AppButton></NuxtLink>
        <NuxtLink to="/app/rooms/new"><AppButton><Plus class="h-4 w-4" />Criar sala</AppButton></NuxtLink>
      </div>
    </div>
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <RoomCard v-for="room in data?.rooms" :key="room.id" :room="room" />
    </div>
    <AppCard v-if="!data?.rooms.length">
      <p class="text-mist">Nenhuma sala ainda.</p>
    </AppCard>
  </div>
</template>
