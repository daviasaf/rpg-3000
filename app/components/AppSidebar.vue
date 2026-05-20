<script setup lang="ts">
import { Bot, BookOpen, Globe2, Home, Menu, PanelLeftClose, Settings, Swords, UserRound, UsersRound } from 'lucide-vue-next'

const links = [
  { to: '/app', icon: Home, label: 'Home' },
  { to: '/app/systems', icon: BookOpen, label: 'Sistemas' },
  { to: '/app/npcs', icon: Bot, label: 'NPCs' },
  { to: '/app/characters', icon: UserRound, label: 'Personagens' },
  { to: '/app/rooms', icon: UsersRound, label: 'Salas' },
  { to: '/app/community', icon: Globe2, label: 'Comunidade' }
]

const expanded = ref(false)

function applySidebarState() {
  if (!import.meta.client) return
  document.documentElement.classList.toggle('sidebar-expanded', expanded.value)
  localStorage.setItem('central-rpg:sidebar-expanded', expanded.value ? '1' : '0')
}

function toggleSidebar() {
  expanded.value = !expanded.value
  applySidebarState()
}

onMounted(() => {
  expanded.value = localStorage.getItem('central-rpg:sidebar-expanded') === '1'
  applySidebarState()
})
</script>

<template>
  <aside class="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/10 bg-black/55 py-4 transition-[width] duration-300 ease-out" :class="expanded ? 'w-[220px] items-stretch px-3' : 'w-[76px] items-center px-0'">
    <div class="flex items-center gap-3" :class="expanded ? 'justify-between' : 'flex-col'">
      <NuxtLink to="/app" class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ember to-flare text-black shadow-[0_4px_12px_rgba(255,138,19,0.16)]" title="Central RPG 3000">
        <Swords class="h-6 w-6" />
      </NuxtLink>
      <button type="button" class="grid h-10 w-10 place-items-center rounded-lg text-mist transition hover:bg-white/10 hover:text-white" :title="expanded ? 'Fechar menu' : 'Abrir menu'" @click="toggleSidebar">
        <PanelLeftClose v-if="expanded" class="h-5 w-5" />
        <Menu v-else class="h-5 w-5" />
      </button>
    </div>

    <nav class="mt-8 flex flex-1 flex-col gap-3">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="flex h-10 items-center rounded-lg text-mist transition hover:bg-white/10 hover:text-white"
        :class="expanded ? 'w-full gap-3 px-3' : 'w-10 justify-center'"
        active-class="bg-white/10 text-ember"
        :title="link.label"
      >
        <component :is="link.icon" class="h-5 w-5 shrink-0" />
        <span v-if="expanded" class="truncate text-sm font-bold">{{ link.label }}</span>
      </NuxtLink>
    </nav>
    <NuxtLink
      to="/app/settings"
      class="flex h-10 items-center rounded-lg text-mist transition hover:bg-white/10 hover:text-white"
      :class="expanded ? 'w-full gap-3 px-3' : 'w-10 justify-center'"
      active-class="bg-white/10 text-ember"
      title="Configuracoes"
    >
      <Settings class="h-5 w-5 shrink-0" />
      <span v-if="expanded" class="truncate text-sm font-bold">Configuracoes</span>
    </NuxtLink>
  </aside>
</template>
