<script setup lang="ts">
defineProps<{
  system: {
    id: string
    name: string
    description: string
    tags: string[]
    visibility: string
    moderationStatus?: string
    createdBy?: { name: string } | null
    _count?: { characters: number; rooms: number }
  }
}>()
</script>

<template>
  <NuxtLink :to="`/app/systems/${system.id}`" class="surface group block rounded-xl p-4 transition hover:-translate-y-0.5 hover:border-ember/45">
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-wrap gap-1.5">
        <span v-for="tag in system.tags.slice(0, 3)" :key="tag" class="rounded-md border border-ember/25 bg-ember/10 px-2 py-0.5 text-[11px] font-bold text-ember">
          {{ tag }}
        </span>
      </div>
      <span class="text-xs font-bold text-mist">
        {{ system.moderationStatus === 'PENDING' ? 'Em analise' : system.moderationStatus === 'REJECTED' ? 'Rejeitado' : system.visibility === 'PUBLIC' ? 'Publico' : 'Privado' }}
      </span>
    </div>
    <h3 class="mt-4 text-lg font-black text-white group-hover:text-ember">{{ system.name }}</h3>
    <p class="mt-2 line-clamp-3 text-sm leading-6 text-mist">{{ system.description }}</p>
    <div class="mt-4 flex items-center justify-between text-xs text-mist">
      <span>{{ system.createdBy?.name || 'Central RPG' }}</span>
      <span>{{ system._count?.characters ?? 0 }} fichas</span>
    </div>
  </NuxtLink>
</template>
