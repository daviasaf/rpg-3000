<script setup lang="ts">
import {
  Activity,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Radio,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  XCircle
} from 'lucide-vue-next'

type Status = 'PENDING' | 'APPROVED' | 'REJECTED'
type AdminView = 'overview' | 'moderation' | 'users'
type SeriesPoint = { key: string; label: string; value: number }
type AdminPost = {
  id: string
  type: 'SYSTEM' | 'NPC' | 'CHARACTER'
  title: string
  description?: string | null
  avatarUrl?: string | null
  tags: string[]
  status: Status
  moderationReason?: string | null
  systemName?: string | null
  snapshotJson: Record<string, any>
  author?: { id?: string; name?: string | null; username?: string | null; email?: string | null; avatarUrl?: string | null; profileColor?: string | null } | null
  comments?: Array<{ id: string; content: string; createdAt: string; user?: { name: string } | null }>
  _count?: { likes: number; comments: number }
  createdAt: string
}
type AdminUser = {
  id: string
  name: string
  username?: string | null
  email: string
  avatarUrl?: string | null
  profileColor?: string | null
  createdAt: string
  updatedAt: string
  _count: {
    systems: number
    npcs: number
    characters: number
    masteredRooms: number
    roomMembers: number
    communityPosts: number
    communityComments: number
    profilePosts: number
    privateMessages: number
  }
}

const { push, apiError } = useToast()
const password = ref('')
const logged = ref(false)
const loading = ref(false)
const view = ref<AdminView>('overview')
const status = ref<Status>('PENDING')
const q = ref('')
const userSearch = ref('')
const expanded = ref(new Set<string>())
const technicalOpen = ref('')
const deletingUserId = ref('')
const pendingDeleteUser = ref<AdminUser | null>(null)

const { data: moderationData, refresh: refreshModeration, error } = await useFetch<{ posts: AdminPost[] }>(() => `/api/admin/moderation?status=${status.value}`, {
  immediate: false,
  watch: false,
  transform: (value: any) => ({ posts: value.posts || [] }),
  default: () => ({ posts: [] })
})
const { data: overview, refresh: refreshOverview } = await useFetch<any>('/api/admin/overview', {
  immediate: false,
  watch: false,
  default: () => ({
    totals: {},
    moderation: {},
    series: {},
    postsByType: {},
    recentUsers: [],
    recentPosts: []
  })
})
const { data: usersData, refresh: refreshUsers } = await useFetch<{ users: AdminUser[] }>('/api/admin/users', {
  immediate: false,
  watch: false,
  default: () => ({ users: [] })
})

const navItems = computed(() => [
  { id: 'overview' as const, label: 'Visao geral', icon: LayoutDashboard, badge: overview.value?.totals?.users || 0 },
  { id: 'moderation' as const, label: 'Analise', icon: ShieldCheck, badge: overview.value?.moderation?.pending || 0 },
  { id: 'users' as const, label: 'Usuarios', icon: Users, badge: usersData.value?.users.length || 0 }
])

watch(error, () => {
  if (error.value?.statusCode === 401) logged.value = false
})

watch(status, async () => {
  if (logged.value) await refreshModeration()
})

onMounted(async () => {
  try {
    await $fetch('/api/admin/me')
    logged.value = true
    await refreshAll()
  } catch {
    logged.value = false
  }
})

const visiblePosts = computed(() => {
  const term = q.value.trim().toLowerCase()
  const items = moderationData.value?.posts || []
  if (!term) return items
  return items.filter((post) => `${post.title} ${post.description || ''} ${post.systemName || ''} ${post.tags.join(' ')} ${post.author?.name || ''} ${post.author?.email || ''}`.toLowerCase().includes(term))
})

const filteredUsers = computed(() => {
  const term = userSearch.value.trim().toLowerCase()
  const users = usersData.value?.users || []
  if (!term) return users
  return users.filter((user) => `${user.name} ${user.username || ''} ${user.email}`.toLowerCase().includes(term))
})

const moderationCounts = computed(() => ({
  total: moderationData.value?.posts.length || 0,
  visible: visiblePosts.value.length,
  systems: (moderationData.value?.posts || []).filter((post) => post.type === 'SYSTEM').length,
  npcs: (moderationData.value?.posts || []).filter((post) => post.type === 'NPC').length,
  characters: (moderationData.value?.posts || []).filter((post) => post.type === 'CHARACTER').length
}))
const launchedTotal = computed(() => (overview.value?.series?.communityPosts || []).reduce((sum: number, item: SeriesPoint) => sum + item.value, 0))

async function refreshAll() {
  await Promise.all([refreshOverview(), refreshUsers(), refreshModeration()])
}

async function login() {
  loading.value = true
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { password: password.value } })
    logged.value = true
    password.value = ''
    await refreshAll()
  } catch (error) {
    apiError(error, 'Nao foi possivel entrar no admin.')
  } finally {
    loading.value = false
  }
}

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  logged.value = false
}

async function setStatus(id: string, next: Status) {
  try {
    const reason = next === 'REJECTED' ? window.prompt('Motivo da rejeicao (opcional):') || '' : ''
    await $fetch(`/api/admin/community/${id}/status`, { method: 'POST', body: { status: next, reason } })
    push(next === 'APPROVED' ? 'Item aprovado.' : 'Item rejeitado.', 'success')
    await refreshAll()
  } catch (error) {
    apiError(error, 'Nao foi possivel atualizar a analise.')
  }
}

async function deletePost(id: string) {
  try {
    await $fetch(`/api/admin/community/${id}`, { method: 'DELETE' })
    push('Item apagado.', 'success')
    await refreshAll()
  } catch (error) {
    apiError(error, 'Nao foi possivel apagar o item.')
  }
}

const userActionItems = computed(() => [
  { key: 'delete', label: 'Excluir usuario', icon: Trash2, danger: true, disabled: Boolean(deletingUserId.value) }
])

function handleUserAction(user: AdminUser, action: string) {
  if (action === 'delete') pendingDeleteUser.value = user
}

async function deleteUser() {
  const user = pendingDeleteUser.value
  if (!user) return

  deletingUserId.value = user.id
  try {
    await $fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    pendingDeleteUser.value = null
    push('Usuario excluido.', 'success')
    await Promise.all([refreshUsers(), refreshOverview()])
  } catch (error) {
    apiError(error, 'Nao foi possivel excluir o usuario.')
  } finally {
    deletingUserId.value = ''
  }
}

function statusText(next: Status) {
  return next === 'PENDING' ? 'Em analise' : next === 'APPROVED' ? 'Aprovado' : 'Rejeitado'
}

function typeText(type: AdminPost['type']) {
  return ({ SYSTEM: 'Sistema', NPC: 'NPC', CHARACTER: 'Personagem' })[type]
}

function typeIcon(type: AdminPost['type']) {
  return ({ SYSTEM: BookOpen, NPC: Bot, CHARACTER: UserRound })[type]
}

function formatDate(value?: string | Date | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isExpanded(id: string) {
  return expanded.value.has(id)
}

function toggle(id: string) {
  const next = new Set(expanded.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expanded.value = next
}

function entries(record: unknown) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return []
  return Object.entries(record as Record<string, unknown>).filter(([, value]) => !Array.isArray(value) && typeof value !== 'object')
}

function snapshotSchema(post: AdminPost) {
  return post.snapshotJson?.schemaJson || post.snapshotJson?.system?.schemaJson || null
}

function snapshotFields(post: AdminPost) {
  return Array.isArray(post.snapshotJson?.fields)
    ? post.snapshotJson.fields
    : Array.isArray(post.snapshotJson?.system?.fields)
      ? post.snapshotJson.system.fields
      : []
}

function snapshotVersion(post: AdminPost) {
  return post.snapshotJson?.version || post.snapshotJson?.schemaJson?.version || 'v1'
}

function maxValue(series?: SeriesPoint[]) {
  return Math.max(1, ...((series || []).map((item) => item.value)))
}

function barHeight(value: number, series?: SeriesPoint[]) {
  return `${Math.max(8, (value / maxValue(series)) * 100)}%`
}

function linePoints(series?: SeriesPoint[]) {
  const items = series || []
  const max = maxValue(items)
  if (items.length <= 1) return '0,80 100,80'
  return items.map((item, index) => {
    const x = (index / (items.length - 1)) * 100
    const y = 92 - (item.value / max) * 72
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
}

function showChartLabel(index: number, total?: number) {
  if (!total) return false
  return index === 0 || index === total - 1 || index % 3 === 0
}
</script>

<template>
  <main class="min-h-screen bg-void text-white">
    <section v-if="!logged" class="grid min-h-screen place-items-center px-5">
      <form class="surface w-full max-w-md rounded-lg p-6" @submit.prevent="login">
        <div class="flex items-center gap-3">
          <div class="grid h-12 w-12 place-items-center rounded-lg bg-ember text-black"><ShieldCheck class="h-6 w-6" /></div>
          <div><p class="text-xs font-black uppercase tracking-[0.12em] text-ember">Toca dos Nerds</p><h1 class="text-2xl font-black">Admin</h1></div>
        </div>
        <label class="mt-6 block"><span class="label">Senha</span><input v-model="password" class="input" type="password" autocomplete="current-password"></label>
        <AppButton class="mt-4 w-full" type="submit" :loading="loading">Entrar</AppButton>
      </form>
    </section>

    <section v-else class="grid min-h-screen lg:grid-cols-[280px_1fr]">
      <aside class="sticky top-0 flex h-screen flex-col border-r border-white/10 bg-[#0b0c14]/95 p-4">
        <div class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div class="grid h-11 w-11 place-items-center rounded-lg bg-ember text-black"><ShieldCheck class="h-5 w-5" /></div>
          <div class="min-w-0">
            <p class="truncate text-sm font-black text-white">Toca dos Nerds</p>
            <p class="text-xs text-mist">Painel administrativo</p>
          </div>
        </div>

        <nav class="mt-5 space-y-1">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition"
            :class="view === item.id ? 'bg-ember text-black' : 'text-mist hover:bg-white/10 hover:text-white'"
            @click="view = item.id"
          >
            <component :is="item.icon" class="h-4 w-4" />
            <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
            <span class="rounded-md px-1.5 py-0.5 text-xs" :class="view === item.id ? 'bg-black/15' : 'bg-white/10 text-mist'">{{ item.badge }}</span>
          </button>
        </nav>

        <button type="button" class="mt-auto flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-mist hover:bg-white/10 hover:text-white" @click="logout"><LogOut class="h-4 w-4" /> Sair</button>
      </aside>

      <div class="min-w-0">
        <header class="sticky top-0 z-20 border-b border-white/10 bg-[#080913]/90 px-4 py-3 backdrop-blur sm:px-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.12em] text-ember">Admin</p>
              <h1 class="text-xl font-black">{{ view === 'overview' ? 'Visao geral do site' : view === 'users' ? 'Usuarios' : 'Analise de conteudo' }}</h1>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="kbd-chip">Atualizado agora</span>
              <AppButton variant="ghost" @click="refreshAll"><Activity class="h-4 w-4" />Atualizar</AppButton>
            </div>
          </div>
        </header>

        <main class="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
          <template v-if="view === 'overview'">
            <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AppCard class="min-h-32">
                <div class="flex items-start justify-between gap-3"><span class="text-xs font-black uppercase tracking-[0.12em] text-mist">Usuarios</span><Users class="h-5 w-5 text-ember" /></div>
                <p class="mt-4 text-3xl font-black text-white">{{ overview.totals?.users || 0 }}</p>
                <p class="mt-1 text-sm text-mist">Contas registradas</p>
              </AppCard>
              <AppCard class="min-h-32">
                <div class="flex items-start justify-between gap-3"><span class="text-xs font-black uppercase tracking-[0.12em] text-mist">Sistemas</span><BookOpen class="h-5 w-5 text-ember" /></div>
                <p class="mt-4 text-3xl font-black text-white">{{ overview.totals?.systems || 0 }}</p>
                <p class="mt-1 text-sm text-mist">Sistemas criados/lancados</p>
              </AppCard>
              <AppCard class="min-h-32">
                <div class="flex items-start justify-between gap-3"><span class="text-xs font-black uppercase tracking-[0.12em] text-mist">Personagens</span><UserRound class="h-5 w-5 text-ember" /></div>
                <p class="mt-4 text-3xl font-black text-white">{{ overview.totals?.characters || 0 }}</p>
                <p class="mt-1 text-sm text-mist">Fichas cadastradas</p>
              </AppCard>
              <AppCard class="min-h-32">
                <div class="flex items-start justify-between gap-3"><span class="text-xs font-black uppercase tracking-[0.12em] text-mist">NPCs</span><Bot class="h-5 w-5 text-ember" /></div>
                <p class="mt-4 text-3xl font-black text-white">{{ overview.totals?.npcs || 0 }}</p>
                <p class="mt-1 text-sm text-mist">NPCs no inventario</p>
              </AppCard>
            </section>

            <section class="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.6fr)]">
              <AppCard class="p-0">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
                  <div>
                    <h2 class="font-black text-white">Registros de usuarios</h2>
                    <p class="text-sm text-mist">Novas contas nos ultimos 14 dias.</p>
                  </div>
                  <span class="kbd-chip">{{ overview.series?.users?.reduce((sum: number, item: SeriesPoint) => sum + item.value, 0) || 0 }} novos</span>
                </div>
                <div class="p-4">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="h-72 w-full overflow-visible">
                    <defs>
                      <linearGradient id="adminUsersGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stop-color="#ff8a13" stop-opacity="0.35" />
                        <stop offset="100%" stop-color="#ff8a13" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                    <polyline :points="`0,100 ${linePoints(overview.series?.users)} 100,100`" fill="url(#adminUsersGradient)" stroke="none" />
                    <polyline :points="linePoints(overview.series?.users)" fill="none" stroke="#ff8a13" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                  </svg>
                  <div class="mt-3 grid grid-cols-7 gap-2 text-center text-[11px] text-mist sm:grid-cols-14">
                    <span v-for="point in overview.series?.users" :key="point.key">{{ point.label }}</span>
                  </div>
                </div>
              </AppCard>

              <AppCard>
                <h2 class="font-black text-white">Conteudo lancado</h2>
                <p class="mt-1 text-sm text-mist">Snapshots enviados para comunidade nos ultimos 14 dias.</p>
                <div v-if="launchedTotal > 0" class="mt-5 h-64">
                  <div class="flex h-full items-end gap-3">
                    <div v-for="(point, index) in overview.series?.communityPosts" :key="point.key" class="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <div class="relative h-full w-full overflow-hidden rounded-lg bg-white/[0.04]">
                        <div class="absolute bottom-0 left-0 right-0 rounded-lg bg-ember/80 transition-all" :style="{ height: barHeight(point.value, overview.series?.communityPosts) }" />
                      </div>
                      <span class="h-3 text-[10px] text-mist">{{ showChartLabel(index, overview.series?.communityPosts?.length) ? point.label : '' }}</span>
                    </div>
                  </div>
                </div>
                <div v-else class="mt-5 grid min-h-44 place-items-center rounded-lg border border-dashed border-white/15 bg-white/[0.025] p-5 text-center">
                  <div>
                    <FileText class="mx-auto h-8 w-8 text-mist" />
                    <p class="mt-3 font-black text-white">Nenhum conteudo lancado nos ultimos dias.</p>
                    <p class="mt-1 text-sm text-mist">Quando houver envios, o grafico aparece aqui.</p>
                  </div>
                </div>
              </AppCard>
            </section>

            <section class="grid gap-5 xl:grid-cols-3">
              <AppCard>
                <h2 class="font-black text-white">Publicacoes por tipo</h2>
                <div class="mt-5 space-y-4">
                  <div>
                    <div class="mb-1 flex justify-between text-sm"><span class="text-mist">Sistemas</span><b>{{ overview.postsByType?.systems || 0 }}</b></div>
                    <div class="h-2 rounded bg-white/10"><div class="h-full rounded bg-ember" :style="{ width: `${Math.min(100, ((overview.postsByType?.systems || 0) / Math.max(1, overview.totals?.communityPosts || 1)) * 100)}%` }" /></div>
                  </div>
                  <div>
                    <div class="mb-1 flex justify-between text-sm"><span class="text-mist">NPCs</span><b>{{ overview.postsByType?.npcs || 0 }}</b></div>
                    <div class="h-2 rounded bg-white/10"><div class="h-full rounded bg-arcane" :style="{ width: `${Math.min(100, ((overview.postsByType?.npcs || 0) / Math.max(1, overview.totals?.communityPosts || 1)) * 100)}%` }" /></div>
                  </div>
                  <div>
                    <div class="mb-1 flex justify-between text-sm"><span class="text-mist">Personagens</span><b>{{ overview.postsByType?.characters || 0 }}</b></div>
                    <div class="h-2 rounded bg-white/10"><div class="h-full rounded bg-emerald-400" :style="{ width: `${Math.min(100, ((overview.postsByType?.characters || 0) / Math.max(1, overview.totals?.communityPosts || 1)) * 100)}%` }" /></div>
                  </div>
                </div>
              </AppCard>

              <AppCard>
                <h2 class="font-black text-white">Saude da comunidade</h2>
                <div class="mt-4 grid gap-3">
                  <div class="soft-row flex items-center justify-between p-3"><span class="flex items-center gap-2 text-mist"><Radio class="h-4 w-4 text-ember" />Salas</span><b>{{ overview.totals?.rooms || 0 }}</b></div>
                  <div class="soft-row flex items-center justify-between p-3"><span class="flex items-center gap-2 text-mist"><MessageSquare class="h-4 w-4 text-ember" />Mensagens</span><b>{{ overview.totals?.messages || 0 }}</b></div>
                  <div class="soft-row flex items-center justify-between p-3"><span class="flex items-center gap-2 text-mist"><FileText class="h-4 w-4 text-ember" />Posts comunidade</span><b>{{ overview.totals?.communityPosts || 0 }}</b></div>
                </div>
              </AppCard>

              <AppCard>
                <h2 class="font-black text-white">Fila de analise</h2>
                <div class="mt-4 grid gap-3">
                  <button class="soft-row flex items-center justify-between p-3 text-left" @click="view = 'moderation'; status = 'PENDING'"><span class="text-mist">Pendentes</span><b class="text-amber-100">{{ overview.moderation?.pending || 0 }}</b></button>
                  <button class="soft-row flex items-center justify-between p-3 text-left" @click="view = 'moderation'; status = 'APPROVED'"><span class="text-mist">Aprovados</span><b class="text-emerald-100">{{ overview.moderation?.approved || 0 }}</b></button>
                  <button class="soft-row flex items-center justify-between p-3 text-left" @click="view = 'moderation'; status = 'REJECTED'"><span class="text-mist">Rejeitados</span><b class="text-red-100">{{ overview.moderation?.rejected || 0 }}</b></button>
                </div>
              </AppCard>
            </section>

            <section class="grid gap-5 xl:grid-cols-2">
              <AppCard class="p-0">
                <div class="border-b border-white/10 p-4"><h2 class="font-black text-white">Usuarios recentes</h2></div>
                <div class="divide-y divide-white/10">
                  <div v-for="user in overview.recentUsers" :key="user.id" class="flex items-center gap-3 p-4">
                    <AppAvatar :name="user.name" :src="user.avatarUrl" :color="user.profileColor" rounded="full" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-black text-white">{{ user.name }}</p>
                      <p class="truncate text-xs text-mist">{{ user.username ? `@${user.username}` : 'sem usuario publico' }} | {{ user.email }}</p>
                    </div>
                    <span class="text-xs text-mist">{{ formatDate(user.createdAt) }}</span>
                  </div>
                </div>
              </AppCard>

              <AppCard class="p-0">
                <div class="border-b border-white/10 p-4"><h2 class="font-black text-white">Envios recentes</h2></div>
                <div class="divide-y divide-white/10">
                  <div v-for="post in overview.recentPosts" :key="post.id" class="flex items-center gap-3 p-4">
                    <AppAvatar :name="post.title" :src="post.avatarUrl" size="sm" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-black text-white">{{ post.title }}</p>
                      <p class="truncate text-xs text-mist">{{ typeText(post.type) }} | {{ post.author?.name || 'Usuario removido' }}</p>
                    </div>
                    <span class="kbd-chip">{{ statusText(post.status) }}</span>
                  </div>
                </div>
              </AppCard>
            </section>
          </template>

          <template v-else-if="view === 'users'">
            <AppCard class="p-0">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
                <div>
                  <h2 class="font-black text-white">Usuarios cadastrados</h2>
                  <p class="text-sm text-mist">Dados publicos e operacionais, sem senha, hash ou tokens.</p>
                </div>
                <label class="relative min-w-[240px] max-w-sm flex-1 sm:flex-none">
                  <Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-mist" />
                  <input v-model="userSearch" class="input pl-9" placeholder="Buscar nome, usuario ou email">
                </label>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full min-w-[1020px] text-left text-sm">
                  <thead class="border-b border-white/10 bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-mist">
                    <tr>
                      <th class="px-4 py-3">Usuario</th>
                      <th class="px-4 py-3">Email</th>
                      <th class="px-4 py-3">Conteudos</th>
                      <th class="px-4 py-3">Social</th>
                      <th class="px-4 py-3">Criado</th>
                      <th class="px-4 py-3">Atualizado</th>
                      <th class="px-4 py-3 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/10">
                    <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-white/[0.035]">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                          <AppAvatar :name="user.name" :src="user.avatarUrl" :color="user.profileColor" rounded="full" />
                          <div class="min-w-0">
                            <p class="truncate font-black text-white">{{ user.name }}</p>
                            <p class="truncate text-xs text-mist">{{ user.username ? `@${user.username}` : 'sem usuario publico' }}</p>
                          </div>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-mist">{{ user.email }}</td>
                      <td class="px-4 py-3 text-mist">
                        {{ user._count.systems }} sistemas, {{ user._count.npcs }} NPCs, {{ user._count.characters }} personagens
                      </td>
                      <td class="px-4 py-3 text-mist">
                        {{ user._count.communityPosts }} posts, {{ user._count.communityComments }} comentarios, {{ user._count.privateMessages }} DMs
                      </td>
                      <td class="px-4 py-3 text-mist">{{ formatDate(user.createdAt) }}</td>
                      <td class="px-4 py-3 text-mist">{{ formatDate(user.updatedAt) }}</td>
                      <td class="px-4 py-3 text-right">
                        <AppActionMenu :items="userActionItems" title="Acoes do usuario" @select="handleUserAction(user, $event)" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="!filteredUsers.length" class="p-4"><EmptyState title="Nenhum usuario encontrado" description="Altere a busca para localizar outros usuarios." /></div>
            </AppCard>
          </template>

          <template v-else>
            <div class="grid gap-4 md:grid-cols-3">
              <MetricCard label="Itens" :value="moderationCounts.total" :icon="ShieldCheck" hint="Filtro atual" />
              <MetricCard label="Visiveis" :value="moderationCounts.visible" :icon="Search" hint="Resultado da busca" tone="arcane" />
              <MetricCard label="Status" :value="statusText(status)" :icon="Clock3" hint="Moderacao" tone="green" />
            </div>

            <AppCard class="p-0">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
                <div><h2 class="font-black text-white">Publicacoes</h2><p class="text-sm text-mist">Analise snapshots independentes da comunidade.</p></div>
                <div class="flex flex-1 flex-wrap items-center justify-end gap-2">
                  <label class="relative min-w-[220px] max-w-sm flex-1 sm:flex-none"><Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-mist" /><input v-model="q" class="input pl-9" placeholder="Buscar por nome, autor, tag"></label>
                  <label class="relative"><ShieldCheck class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-mist" /><select v-model="status" class="select min-w-44 pl-9"><option value="PENDING">Em analise</option><option value="APPROVED">Aprovados</option><option value="REJECTED">Rejeitados</option></select></label>
                  <span class="kbd-chip">{{ moderationCounts.visible }} resultados</span>
                </div>
              </div>

              <div v-if="error" class="p-4"><EmptyState :icon="XCircle" title="Nao foi possivel carregar" description="Verifique sua sessao administrativa e tente novamente." /></div>
              <div v-else class="divide-y divide-white/10">
                <article v-for="post in visiblePosts" :key="post.id" class="p-4">
                  <div class="grid gap-4 lg:grid-cols-[1fr_auto]">
                    <button type="button" class="flex min-w-0 gap-3 text-left" @click="toggle(post.id)">
                      <AppAvatar :name="post.title" :src="post.avatarUrl" size="lg" />
                      <span class="min-w-0">
                        <span class="flex flex-wrap items-center gap-2"><span class="kbd-chip">{{ statusText(post.status) }}</span><span class="kbd-chip"><component :is="typeIcon(post.type)" class="mr-1 inline h-3.5 w-3.5" />{{ typeText(post.type) }}</span><span class="kbd-chip">{{ post.systemName || 'Generico' }}</span></span>
                        <span class="mt-3 block text-lg font-black text-white">{{ post.title }}</span>
                        <span class="mt-1 line-clamp-2 block text-sm leading-6 text-mist">{{ post.description || 'Sem descricao.' }}</span>
                        <span v-if="post.status === 'REJECTED' && post.moderationReason" class="mt-2 block rounded-md border border-flare/30 bg-flare/10 px-2 py-1 text-xs font-bold text-red-100">Motivo: {{ post.moderationReason }}</span>
                        <span class="mt-2 block text-xs text-mist">por {{ post.author?.name || 'Usuario removido' }} | {{ post.author?.email || 'sem email' }} | {{ post._count?.likes || 0 }} curtidas</span>
                      </span>
                    </button>
                    <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                      <AppButton variant="ghost" @click="setStatus(post.id, 'APPROVED')"><CheckCircle2 class="h-4 w-4" />Aprovar</AppButton>
                      <AppButton variant="ghost" @click="setStatus(post.id, 'REJECTED')"><XCircle class="h-4 w-4" />Rejeitar</AppButton>
                      <AppButton variant="danger" @click="deletePost(post.id)"><Trash2 class="h-4 w-4" />Apagar</AppButton>
                      <button type="button" class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-ember hover:bg-white/10" @click="toggle(post.id)"><ChevronDown class="h-5 w-5 transition" :class="isExpanded(post.id) ? 'rotate-180' : ''" /></button>
                    </div>
                  </div>

                  <div v-if="isExpanded(post.id)" class="mt-4 grid gap-4 border-t border-white/10 pt-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
                    <div class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 class="font-black text-white">Resumo para analise</h4>
                          <p class="mt-1 text-sm text-mist">{{ post.description || 'Sem descricao.' }}</p>
                        </div>
                        <span class="kbd-chip">{{ snapshotVersion(post) }}</span>
                      </div>
                      <SystemStructurePreview
                        v-if="post.type === 'SYSTEM'"
                        class="mt-4"
                        :schema="snapshotSchema(post)"
                        :fields="snapshotFields(post)"
                        compact
                      />
                      <dl v-else class="mt-3 grid gap-3 text-sm">
                        <div v-for="[key, value] in entries(post.snapshotJson?.dataJson || post.snapshotJson)" :key="key">
                          <dt class="label">{{ key }}</dt>
                          <dd class="break-words text-white">{{ value }}</dd>
                        </div>
                      </dl>
                      <div v-if="Array.isArray(post.snapshotJson?.dataJson?.attacks)" class="mt-4 flex flex-wrap gap-2">
                        <span v-for="attack in post.snapshotJson.dataJson.attacks" :key="String(attack.name)" class="rounded-md border border-ember/25 bg-ember/10 px-2 py-1 text-xs font-bold text-ember">{{ attack.name }}: {{ attack.damage }}</span>
                      </div>
                      <button type="button" class="mt-4 text-xs font-bold text-mist hover:text-white" @click="technicalOpen = technicalOpen === post.id ? '' : post.id">Ver dados tecnicos</button>
                      <pre v-if="technicalOpen === post.id" class="mt-3 max-h-64 overflow-y-auto rounded-md bg-black/20 p-3 text-xs leading-5 text-mist">{{ JSON.stringify(post.snapshotJson, null, 2) }}</pre>
                    </div>
                    <div class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                      <h4 class="font-black text-white">Comentarios recentes</h4>
                      <div class="mt-3 max-h-64 space-y-2 overflow-y-auto pr-2">
                        <p v-for="comment in post.comments" :key="comment.id" class="rounded-md bg-white/[0.04] p-2 text-sm text-mist"><b class="text-white">{{ comment.user?.name || 'Usuario removido' }}:</b> {{ comment.content }} <span class="text-xs text-mist">{{ formatDate(comment.createdAt) }}</span></p>
                        <p v-if="!post.comments?.length" class="text-sm text-mist">Sem comentarios.</p>
                      </div>
                    </div>
                  </div>
                </article>
                <div v-if="!visiblePosts.length" class="p-4"><EmptyState title="Nada encontrado" description="Altere o filtro ou a busca para ver outros itens." /></div>
              </div>
            </AppCard>
          </template>
        </main>
      </div>
    </section>
    <ToastStack />
    <ConfirmModal
      :open="!!pendingDeleteUser"
      title="Excluir usuario"
      :message="`Excluir ${pendingDeleteUser?.name || 'este usuario'}? A conta sera removida e relacoes privadas serao apagadas. Esta acao nao pode ser desfeita.`"
      confirm-label="Excluir usuario"
      :loading="!!deletingUserId"
      @close="pendingDeleteUser = null"
      @confirm="deleteUser"
    />
  </main>
</template>

