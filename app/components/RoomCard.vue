<script setup lang="ts">
defineProps<{
  room: {
    id: string
    name: string
    description?: string | null
    code: string
    system?: { name: string }
    master?: { name: string }
    _count?: { members: number }
    members?: unknown[]
  }
}>()
</script>

<template>
  <NuxtLink :to="`/app/rooms/${room.id}`" class="surface group block rounded-xl p-4 transition hover:-translate-y-0.5 hover:border-ember/45">
    <span class="rounded-md border border-ember/25 bg-ember/10 px-2 py-0.5 text-[11px] font-bold text-ember">{{ room.system?.name }}</span>
    <h3 class="mt-4 text-lg font-black text-white group-hover:text-ember">{{ room.name }}</h3>
    <p class="mt-2 line-clamp-2 text-sm text-mist">{{ room.description || 'Campanha pronta para a proxima sessao.' }}</p>
    <div class="mt-4 grid grid-cols-3 gap-2 text-xs text-mist">
      <span><b class="block text-white">{{ room.code }}</b> Codigo</span>
      <span><b class="block text-white">{{ room.master?.name }}</b> Mestre</span>
      <span><b class="block text-white">{{ room._count?.members ?? room.members?.length ?? 0 }}</b> Jogadores</span>
    </div>
  </NuxtLink>
</template>
