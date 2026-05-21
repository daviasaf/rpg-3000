<script setup lang="ts">
import { Settings } from 'lucide-vue-next'

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
  <article class="surface group relative rounded-lg p-4 transition hover:border-ember/45">
    <div class="flex items-start justify-between gap-3">
      <NuxtLink :to="`/app/rooms/${room.id}`" class="min-w-0 flex-1">
        <span class="rounded-md border border-ember/25 bg-ember/10 px-2 py-0.5 text-[11px] font-bold text-ember">{{ room.system?.name }}</span>
        <h3 class="mt-4 truncate text-lg font-black text-white group-hover:text-ember">{{ room.name }}</h3>
      </NuxtLink>
      <NuxtLink
        :to="`/app/rooms/${room.id}?settings=1`"
        class="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-mist transition hover:border-ember/40 hover:text-white"
        title="Configuracoes da sala"
        @click.stop
      >
        <Settings class="h-4 w-4" />
      </NuxtLink>
    </div>
    <NuxtLink :to="`/app/rooms/${room.id}`" class="mt-2 block">
      <p class="line-clamp-2 min-h-10 text-sm text-mist">{{ room.description || 'Campanha pronta para a proxima sessao.' }}</p>
      <div class="mt-4 grid grid-cols-3 gap-2 text-xs text-mist">
        <span><b class="block text-white">{{ room.code }}</b> Codigo</span>
        <span><b class="block truncate text-white">{{ room.master?.name }}</b> Mestre</span>
        <span><b class="block text-white">{{ room._count?.members ?? room.members?.length ?? 0 }}</b> Jogadores</span>
      </div>
    </NuxtLink>
  </article>
</template>
