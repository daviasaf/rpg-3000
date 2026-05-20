<script setup lang="ts">
const auth = useAuthStore()
const accent = computed(() => auth.user?.profileColor || '#ff8a13')
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-white/10 bg-void/95 px-4 py-3 sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-7xl items-center justify-between">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-ember">Central RPG 3000</p>
        <p class="text-sm text-mist">Mesas, fichas e sistemas sem amarras.</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="hidden text-right sm:block">
          <p class="text-sm font-bold text-white">{{ auth.user?.name }}</p>
          <p class="text-xs text-mist">{{ auth.user?.email }}</p>
        </div>
        <div class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-sm font-black text-white" :style="{ backgroundColor: `${accent}33`, borderColor: `${accent}66` }">
          {{ auth.user?.name?.slice(0, 1).toUpperCase() }}
        </div>
      </div>
    </div>
  </header>
</template>
