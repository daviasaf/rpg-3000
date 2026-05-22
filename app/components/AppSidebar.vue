<script setup lang="ts">
import { Bot, BookOpen, Globe2, Home, Mail, Menu, PanelLeftClose, Settings, Swords, UserRound, UsersRound } from 'lucide-vue-next'

const links = [
  { to: '/app', icon: Home, label: 'Home' },
  { to: '/app/systems', icon: BookOpen, label: 'Sistemas' },
  { to: '/app/npcs', icon: Bot, label: 'NPCs' },
  { to: '/app/characters', icon: UserRound, label: 'Personagens' },
  { to: '/app/rooms', icon: UsersRound, label: 'Salas' },
  { to: '/app/community', icon: Globe2, label: 'Comunidade' },
  { to: '/app/friends', icon: Mail, label: 'Social', notification: true }
]

const route = useRoute()
const expanded = ref(false)
const socialNotifications = ref({ unreadMessages: 0, pendingRequests: 0, total: 0 })
let notificationTimer: ReturnType<typeof setInterval> | null = null

const socialCount = computed(() => socialNotifications.value.total)

async function refreshSocialNotifications() {
  try {
    socialNotifications.value = await $fetch('/api/social/notifications')
  } catch {
    socialNotifications.value = { unreadMessages: 0, pendingRequests: 0, total: 0 }
  }
}

function badgeLabel(count: number) {
  return count > 99 ? '99+' : String(count)
}

function applySidebarState() {
  if (!import.meta.client) return
  document.documentElement.classList.toggle('sidebar-expanded', expanded.value)
  localStorage.setItem('central-rpg:sidebar-expanded', expanded.value ? '1' : '0')
}

function toggleSidebar() {
  expanded.value = !expanded.value
  applySidebarState()
}

watch(() => route.fullPath, () => {
  if (route.path.startsWith('/app/friends')) void refreshSocialNotifications()
})

onMounted(() => {
  const saved = localStorage.getItem('central-rpg:sidebar-expanded')
  expanded.value = saved === null ? window.matchMedia('(min-width: 768px)').matches : saved === '1'
  applySidebarState()
  void refreshSocialNotifications()
  notificationTimer = setInterval(() => void refreshSocialNotifications(), 20000)
})

onBeforeUnmount(() => {
  if (notificationTimer) clearInterval(notificationTimer)
})
</script>

<template>
  <aside class="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/10 bg-[#0b0c14]/90 py-4 backdrop-blur md:flex transition-[width] duration-300 ease-out" :class="expanded ? 'w-[220px] items-stretch px-3' : 'w-[76px] items-center px-0'">
    <div class="flex items-center gap-3" :class="expanded ? 'justify-between' : 'flex-col'">
      <NuxtLink to="/app/profile" class="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-ember text-black shadow-[0_1px_0_rgba(255,255,255,0.24)_inset]" title="Meu perfil">
        <Swords class="h-6 w-6" />
      </NuxtLink>
      <button type="button" class="grid h-10 w-10 place-items-center rounded-lg text-mist transition hover:bg-white/10 hover:text-white" :title="expanded ? 'Fechar menu' : 'Abrir menu'" @click="toggleSidebar">
        <PanelLeftClose v-if="expanded" class="h-5 w-5" />
        <Menu v-else class="h-5 w-5" />
      </button>
    </div>

    <nav class="mt-8 flex flex-1 flex-col gap-1.5">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="relative flex h-10 items-center rounded-lg text-mist transition hover:bg-white/10 hover:text-white"
        :class="expanded ? 'w-full gap-3 px-3' : 'w-10 justify-center'"
        active-class="bg-white/10 text-ember"
        :title="link.label"
      >
        <span class="relative grid place-items-center">
          <component :is="link.icon" class="h-5 w-5 shrink-0" />
          <span v-if="link.notification && socialCount" class="absolute -right-2 -top-2 min-w-4 rounded-full bg-flare px-1 text-center text-[10px] font-black leading-4 text-white ring-2 ring-[#0b0c14]">{{ badgeLabel(socialCount) }}</span>
        </span>
        <span v-if="expanded" class="truncate text-sm font-bold">{{ link.label }}</span>
        <span v-if="expanded && link.notification && socialCount" class="ml-auto rounded-full bg-flare px-2 py-0.5 text-[10px] font-black text-white">{{ badgeLabel(socialCount) }}</span>
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

  <nav class="fixed inset-x-3 bottom-3 z-40 grid grid-cols-7 rounded-lg border border-white/10 bg-[#0b0c14]/95 p-1 shadow-soft backdrop-blur md:hidden">
    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="relative grid min-h-12 place-items-center rounded-md px-1 text-mist transition hover:bg-white/10 hover:text-white"
      active-class="bg-white/10 text-ember"
      :title="link.label"
    >
      <span class="relative grid place-items-center">
        <component :is="link.icon" class="h-5 w-5" />
        <span v-if="link.notification && socialCount" class="absolute -right-2 -top-2 min-w-4 rounded-full bg-flare px-1 text-center text-[10px] font-black leading-4 text-white ring-2 ring-[#0b0c14]">{{ badgeLabel(socialCount) }}</span>
      </span>
      <span class="mt-0.5 max-w-full truncate text-[10px] font-bold">{{ link.label }}</span>
    </NuxtLink>
  </nav>
</template>
