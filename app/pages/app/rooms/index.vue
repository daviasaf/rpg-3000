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
    <AppPageHeader title="Minhas salas" description="Campanhas, convites e sessoes ativas organizadas como workspaces de mesa.">
      <template #actions>
        <NuxtLink to="/app/rooms/join"><AppButton variant="ghost"><LogIn class="h-4 w-4" />Entrar por codigo</AppButton></NuxtLink>
        <NuxtLink to="/app/rooms/new"><AppButton><Plus class="h-4 w-4" />Criar sala</AppButton></NuxtLink>
      </template>
    </AppPageHeader>
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <RoomCard v-for="room in data?.rooms" :key="room.id" :room="room" />
    </div>
    <EmptyState v-if="!data?.rooms.length" :icon="LogIn" title="Nenhuma sala ainda" description="Crie sua primeira mesa ou entre em uma campanha usando o codigo do mestre.">
    </EmptyState>
  </div>
</template>
