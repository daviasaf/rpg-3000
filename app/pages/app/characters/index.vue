<script setup lang="ts">
import { Plus, UserRound } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { data } = await useFetch<{ characters: Array<{
  id: string
  name: string
  description?: string | null
  avatarUrl?: string | null
  moderationStatus?: string | null
  moderationReason?: string | null
  system?: { name: string }
}> }>('/api/characters')
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader title="Personagens" description="Suas fichas dinamicas, prontas para qualquer sistema.">
      <template #actions>
        <NuxtLink to="/app/characters/new"><AppButton><Plus class="h-4 w-4" />Novo personagem</AppButton></NuxtLink>
      </template>
    </AppPageHeader>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <CharacterCard v-for="character in data?.characters" :key="character.id" :character="character" />
    </div>
    <EmptyState v-if="!data?.characters.length" :icon="UserRound" title="Voce ainda nao tem personagens" description="Crie uma ficha para usar nas sessoes, rolagens e salas.">
    </EmptyState>
  </div>
</template>

