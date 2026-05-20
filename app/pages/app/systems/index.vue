<script setup lang="ts">
import { BookOpen, Plus } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { data } = await useFetch<{ systems: Array<{
  id: string
  name: string
  description: string
  tags: string[]
  visibility: string
  moderationStatus?: string
  moderationReason?: string | null
  createdBy?: { name: string } | null
  _count?: { characters: number; rooms: number }
}> }>('/api/systems?mine=true')
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader title="Meus sistemas" description="Crie e edite regras genericas para fichas, NPCs e salas.">
      <template #actions>
        <NuxtLink to="/app/systems/new"><AppButton><Plus class="h-4 w-4" />Criar sistema</AppButton></NuxtLink>
      </template>
    </AppPageHeader>
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <SystemCard v-for="system in data?.systems" :key="system.id" :system="system" />
    </div>
    <EmptyState v-if="!data?.systems.length" :icon="BookOpen" title="Nenhum sistema criado ainda" description="Crie seu primeiro sistema para montar fichas, NPCs e salas.">
    </EmptyState>
  </div>
</template>
