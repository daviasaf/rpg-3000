<script setup lang="ts">
import { Plus } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { data } = await useFetch<{ systems: Array<{
  id: string
  name: string
  description: string
  tags: string[]
  visibility: string
  moderationStatus?: string
  createdBy?: { name: string } | null
  _count?: { characters: number; rooms: number }
}> }>('/api/systems?mine=true')
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="page-title">Meus sistemas</h1>
        <p class="muted mt-1">Crie e edite os sistemas que voce controla.</p>
      </div>
      <NuxtLink to="/app/systems/new" class="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-ember to-flare px-4 py-2.5 text-sm font-bold text-black shadow-[0_4px_12px_rgba(255,138,19,0.18)] hover:brightness-110">
        <Plus class="h-4 w-4" />
        Criar sistema
      </NuxtLink>
    </div>
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <SystemCard v-for="system in data?.systems" :key="system.id" :system="system" />
    </div>
    <AppCard v-if="!data?.systems.length">
      <div>
        <div>
          <h2 class="text-lg font-black text-white">Nenhum sistema criado ainda</h2>
          <p class="mt-1 text-mist">Crie seu primeiro sistema para montar fichas, NPCs e salas.</p>
        </div>
      </div>
    </AppCard>
  </div>
</template>
