<script setup lang="ts">
defineProps<{
  character: {
    id: string
    name: string
    description?: string | null
    avatarUrl?: string | null
    moderationStatus?: string | null
    moderationReason?: string | null
    system?: { name: string }
  }
}>()
</script>

<template>
  <NuxtLink :to="`/app/characters/${character.id}`" class="surface group block overflow-hidden rounded-lg transition hover:border-arcane/50">
    <div class="grid aspect-[4/3] place-items-center bg-white/[0.04]">
      <img v-if="character.avatarUrl" :src="character.avatarUrl" :alt="character.name" class="h-full w-full object-cover">
      <AppAvatar v-else :name="character.name" size="xl" />
    </div>
    <div class="p-4">
      <div class="flex flex-wrap gap-2">
        <span class="rounded-md border border-ember/25 bg-ember/10 px-2 py-0.5 text-[11px] font-bold text-ember">{{ character.system?.name }}</span>
        <span v-if="character.moderationStatus === 'PENDING'" class="rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[11px] font-bold text-amber-100">Em analise</span>
        <span v-if="character.moderationStatus === 'REJECTED'" class="rounded-md border border-flare/35 bg-flare/10 px-2 py-0.5 text-[11px] font-bold text-red-100">Rejeitado</span>
      </div>
      <h3 class="mt-3 text-lg font-black text-white group-hover:text-ember">{{ character.name }}</h3>
      <p class="mt-1 line-clamp-2 text-sm text-mist">{{ character.description || 'Sem notas.' }}</p>
      <p v-if="character.moderationStatus === 'REJECTED'" class="mt-3 rounded-md border border-flare/30 bg-flare/10 px-2 py-1 text-xs font-bold text-red-100">
        {{ character.moderationReason || 'Bloqueado para edicao.' }}
      </p>
    </div>
  </NuxtLink>
</template>

