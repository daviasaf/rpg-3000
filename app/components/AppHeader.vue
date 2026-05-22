<script setup lang="ts">
import { LogOut, Settings } from 'lucide-vue-next'

const auth = useAuthStore()
const accent = computed(() => auth.user?.profileColor || '#ff8a13')
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-white/10 bg-[#080913]/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-7xl items-center gap-3">
      <div class="min-w-0 flex-1">
        <p class="text-xs font-bold uppercase tracking-[0.12em] text-ember">Toca dos Nerds</p>
        <p class="hidden text-sm text-mist sm:block">Mesas, fichas e sistemas sem amarras.</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="hidden text-right md:block">
          <p class="text-sm font-bold text-white">{{ auth.user?.name }}</p>
          <p class="text-xs text-mist">{{ auth.user?.email }}</p>
        </div>
        <NuxtLink to="/app/profile" title="Meu perfil">
          <AppAvatar :name="auth.user?.name" :src="auth.user?.avatarUrl" :color="accent" />
        </NuxtLink>
      </div>
    </div>
  </header>
</template>

