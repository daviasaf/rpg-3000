<script setup lang="ts">
import { Plus } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { data } = await useFetch<{ characters: Array<{
  id: string
  name: string
  description?: string | null
  avatarUrl?: string | null
  system?: { name: string }
}> }>('/api/characters')
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="page-title">Personagens</h1>
        <p class="muted mt-1">Suas fichas dinamicas, prontas para qualquer sistema.</p>
      </div>
      <NuxtLink to="/app/characters/new"><AppButton><Plus class="h-4 w-4" />Novo personagem</AppButton></NuxtLink>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <CharacterCard v-for="character in data?.characters" :key="character.id" :character="character" />
    </div>
    <AppCard v-if="!data?.characters.length">
      <p class="text-mist">Voce ainda nao tem personagens.</p>
    </AppCard>
  </div>
</template>
