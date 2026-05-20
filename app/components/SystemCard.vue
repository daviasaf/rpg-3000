<script setup lang="ts">
defineProps<{
  system: {
    id: string
    name: string
    description: string
    tags: string[]
    visibility: string
    avatarUrl?: string | null
    moderationStatus?: string
    moderationReason?: string | null
    createdBy?: { name: string } | null
    _count?: { characters: number; rooms: number }
  }
}>()
</script>

<template>
  <NuxtLink :to="`/app/systems/${system.id}`" class="surface group block rounded-lg p-4 transition hover:border-ember/45">
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-wrap gap-1.5">
        <span v-for="tag in system.tags.slice(0, 3)" :key="tag" class="rounded-md border border-ember/25 bg-ember/10 px-2 py-0.5 text-[11px] font-bold text-ember">
          {{ tag }}
        </span>
      </div>
      <span class="rounded-md border px-2 py-1 text-xs font-bold" :class="system.moderationStatus === 'REJECTED' ? 'border-flare/35 bg-flare/10 text-red-100' : 'border-white/10 bg-white/[0.04] text-mist'">
        {{ system.moderationStatus === 'PENDING' ? 'Em analise' : system.moderationStatus === 'REJECTED' ? 'Rejeitado' : system.visibility === 'PUBLIC' ? 'Publico' : 'Privado' }}
      </span>
    </div>
    <div class="mt-4 flex items-center gap-3">
      <AppAvatar :name="system.name" :src="system.avatarUrl" size="md" />
      <h3 class="min-w-0 text-lg font-black text-white group-hover:text-ember">{{ system.name }}</h3>
    </div>
    <p class="mt-2 line-clamp-3 text-sm leading-6 text-mist">{{ system.description }}</p>
    <p v-if="system.moderationStatus === 'REJECTED'" class="mt-3 rounded-md border border-flare/30 bg-flare/10 px-2 py-1 text-xs font-bold text-red-100">
      {{ system.moderationReason || 'Bloqueado para edicao.' }}
    </p>
    <div class="mt-4 flex items-center justify-between text-xs text-mist">
      <span>{{ system.createdBy?.name || 'Central RPG' }}</span>
      <span>{{ system._count?.characters ?? 0 }} fichas</span>
    </div>
  </NuxtLink>
</template>
