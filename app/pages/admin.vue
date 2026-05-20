<script setup lang="ts">
import { Bot, CheckCircle2, ChevronDown, Clock3, Filter, LogOut, Search, ShieldCheck, Swords, Trash2, XCircle } from 'lucide-vue-next'

type Status = 'PENDING' | 'APPROVED' | 'REJECTED'
type AdminSystem = {
  id: string
  name: string
  description: string
  tags: string[]
  visibility: string
  moderationStatus: Status
  createdBy?: { name: string; email: string } | null
  fields?: Array<{ key: string; label: string; type: string; category: string; defaultValue?: unknown }>
  comments?: Array<{ id: string; content: string; createdAt: string; user?: { name: string } | null }>
  _count?: { characters: number; rooms: number; likes: number; comments: number }
}
type AdminNpc = {
  id: string
  name: string
  description?: string | null
  isCommunity: boolean
  moderationStatus: Status
  system?: { name: string } | null
  createdBy?: { name: string; email: string } | null
  dataJson: Record<string, unknown>
  comments?: Array<{ id: string; content: string; createdAt: string; user?: { name: string } | null }>
  _count?: { likes: number; comments: number }
}

const { push, apiError } = useToast()
const password = ref('')
const logged = ref(false)
const loading = ref(false)
const status = ref<Status>('PENDING')
const tab = ref<'systems' | 'npcs'>('systems')
const q = ref('')
const expanded = ref(new Set<string>())

const { data, refresh, error } = await useFetch<{ systems: AdminSystem[]; npcs: AdminNpc[] }>(() => `/api/admin/moderation?status=${status.value}`, {
  immediate: false,
  watch: false
})

watch(error, () => {
  if (error.value?.statusCode === 401) logged.value = false
})

onMounted(async () => {
  try {
    await $fetch('/api/admin/me')
    logged.value = true
    await refresh()
  } catch {
    logged.value = false
  }
})

watch(status, async () => {
  if (logged.value) await refresh()
})

async function login() {
  loading.value = true
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { password: password.value } })
    logged.value = true
    password.value = ''
    await refresh()
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

async function setItemStatus(kind: 'systems' | 'npcs', id: string, next: Status) {
  try {
    await $fetch(`/api/admin/${kind}/${id}/status`, { method: 'POST', body: { status: next } })
    push(next === 'APPROVED' ? 'Item aprovado.' : 'Item rejeitado.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel atualizar a analise.')
  }
}

async function deleteItem(kind: 'systems' | 'npcs', id: string) {
  try {
    await $fetch(`/api/admin/${kind}/${id}`, { method: 'DELETE' })
    push('Item apagado.', 'success')
    await refresh()
  } catch (error) {
    apiError(error, 'Nao foi possivel apagar o item.')
  }
}

const visibleSystems = computed(() => {
  const term = q.value.trim().toLowerCase()
  const items = data.value?.systems || []
  if (!term) return items
  return items.filter((system) => [
    system.name,
    system.description,
    system.createdBy?.name,
    system.createdBy?.email,
    ...system.tags
  ].filter(Boolean).join(' ').toLowerCase().includes(term))
})

const visibleNpcs = computed(() => {
  const term = q.value.trim().toLowerCase()
  const items = data.value?.npcs || []
  if (!term) return items
  return items.filter((npc) => [
    npc.name,
    npc.description,
    npc.system?.name,
    npc.createdBy?.name,
    npc.createdBy?.email
  ].filter(Boolean).join(' ').toLowerCase().includes(term))
})

const counts = computed(() => ({
  systems: data.value?.systems.length || 0,
  npcs: data.value?.npcs.length || 0,
  visible: tab.value === 'systems' ? visibleSystems.value.length : visibleNpcs.value.length
}))

function statusText(next: Status) {
  return next === 'PENDING' ? 'Em analise' : next === 'APPROVED' ? 'Aprovado' : 'Rejeitado'
}

function itemKey(kind: 'systems' | 'npcs', id: string) {
  return `${kind}:${id}`
}

function isExpanded(kind: 'systems' | 'npcs', id: string) {
  return expanded.value.has(itemKey(kind, id))
}

function toggleItem(kind: 'systems' | 'npcs', id: string) {
  const key = itemKey(kind, id)
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}
</script>

<template>
  <main class="min-h-screen bg-void text-white">
    <section v-if="!logged" class="grid min-h-screen place-items-center px-5">
      <form class="surface w-full max-w-md rounded-lg p-6" @submit.prevent="login">
        <div class="flex items-center gap-3">
          <div class="grid h-12 w-12 place-items-center rounded-lg bg-ember text-black">
            <ShieldCheck class="h-6 w-6" />
          </div>
          <div>
            <p class="text-xs font-black uppercase tracking-[0.12em] text-ember">Central RPG 3000</p>
            <h1 class="text-2xl font-black">Admin</h1>
          </div>
        </div>
        <label class="mt-6 block">
          <span class="label">Senha</span>
          <input v-model="password" class="input" type="password" autocomplete="current-password">
        </label>
        <AppButton class="mt-4 w-full" type="submit" :loading="loading">Entrar</AppButton>
      </form>
    </section>

    <section v-else class="grid min-h-screen lg:grid-cols-[240px_1fr]">
      <aside class="border-r border-white/10 bg-[#0b0c14]/90 p-4">
        <div class="flex items-center gap-3">
          <div class="grid h-11 w-11 place-items-center rounded-lg bg-ember text-black">
            <ShieldCheck class="h-5 w-5" />
          </div>
          <div>
            <p class="text-sm font-black">Admin</p>
            <p class="text-xs text-mist">Moderacao</p>
          </div>
        </div>
        <nav class="mt-8 space-y-1">
          <button type="button" class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold" :class="tab === 'systems' ? 'bg-white/10 text-ember' : 'text-mist hover:bg-white/10 hover:text-white'" @click="tab = 'systems'">
            <Swords class="h-4 w-4" /> Sistemas
          </button>
          <button type="button" class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold" :class="tab === 'npcs' ? 'bg-white/10 text-ember' : 'text-mist hover:bg-white/10 hover:text-white'" @click="tab = 'npcs'">
            <Bot class="h-4 w-4" /> NPCs
          </button>
        </nav>
        <button type="button" class="mt-8 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-mist hover:bg-white/10 hover:text-white" @click="logout">
          <LogOut class="h-4 w-4" /> Sair
        </button>
      </aside>

      <div class="min-w-0">
        <header class="sticky top-0 z-20 border-b border-white/10 bg-[#080913]/90 px-4 py-3 backdrop-blur sm:px-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.12em] text-ember">Central RPG 3000</p>
              <h1 class="text-xl font-black">Painel de analise</h1>
            </div>
            <AppButton variant="ghost" @click="logout"><LogOut class="h-4 w-4" />Sair</AppButton>
          </div>
        </header>

        <main class="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
          <div class="grid gap-4 md:grid-cols-3">
            <MetricCard label="Sistemas" :value="counts.systems" :icon="Swords" hint="Itens no filtro atual" />
            <MetricCard label="NPCs" :value="counts.npcs" :icon="Bot" hint="Criaturas e personagens publicados" tone="arcane" />
            <MetricCard label="Visiveis" :value="counts.visible" :icon="Clock3" :hint="statusText(status)" tone="green" />
          </div>

          <AppCard class="p-0">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
              <div>
                <h2 class="font-black text-white">{{ tab === 'systems' ? 'Sistemas' : 'NPCs' }}</h2>
                <p class="text-sm text-mist">Revise conteudo da comunidade com acoes rapidas e reversiveis.</p>
              </div>
              <div class="flex flex-1 flex-wrap items-center justify-end gap-2">
                <label class="relative min-w-[220px] max-w-sm flex-1 sm:flex-none">
                  <Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-mist" />
                  <input v-model="q" class="input pl-9" placeholder="Buscar por nome, autor, tag">
                </label>
                <label class="relative">
                  <Filter class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-mist" />
                  <select v-model="status" class="select min-w-44 pl-9">
                    <option value="PENDING">Em analise</option>
                    <option value="APPROVED">Aprovados</option>
                    <option value="REJECTED">Rejeitados</option>
                  </select>
                </label>
                <span class="kbd-chip">{{ counts.visible }} resultados</span>
              </div>
            </div>

            <div v-if="error" class="p-4">
              <EmptyState :icon="XCircle" title="Nao foi possivel carregar" description="Verifique sua sessao administrativa e tente novamente." />
            </div>

            <div v-else-if="tab === 'systems'" class="divide-y divide-white/10">
              <article v-for="system in visibleSystems" :key="system.id" class="p-4">
                <div class="grid gap-4 lg:grid-cols-[1fr_auto]">
                <button type="button" class="min-w-0 text-left" @click="toggleItem('systems', system.id)">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="kbd-chip">{{ statusText(system.moderationStatus) }}</span>
                    <span class="kbd-chip">{{ system.visibility }}</span>
                    <span v-for="tag in system.tags.slice(0, 4)" :key="tag" class="kbd-chip">{{ tag }}</span>
                  </div>
                  <h3 class="mt-3 text-lg font-black text-white">{{ system.name }}</h3>
                  <p class="mt-1 line-clamp-2 text-sm leading-6 text-mist">{{ system.description }}</p>
                  <p class="mt-2 text-xs text-mist">por {{ system.createdBy?.name || 'Sem autor' }} · {{ system.createdBy?.email || 'sem email' }} · {{ system._count?.likes || 0 }} curtidas</p>
                </button>
                <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                  <AppButton variant="ghost" @click="setItemStatus('systems', system.id, 'APPROVED')"><CheckCircle2 class="h-4 w-4" />Aprovar</AppButton>
                  <AppButton variant="ghost" @click="setItemStatus('systems', system.id, 'REJECTED')"><XCircle class="h-4 w-4" />Rejeitar</AppButton>
                  <AppButton variant="danger" @click="deleteItem('systems', system.id)"><Trash2 class="h-4 w-4" />Apagar</AppButton>
                  <button type="button" class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-ember hover:bg-white/10" @click="toggleItem('systems', system.id)">
                    <ChevronDown class="h-5 w-5 transition" :class="isExpanded('systems', system.id) ? 'rotate-180' : ''" />
                  </button>
                </div>
                </div>
                <div v-if="isExpanded('systems', system.id)" class="mt-4 grid gap-4 border-t border-white/10 pt-4 lg:grid-cols-2">
                  <div class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <h4 class="font-black text-white">Campos da ficha</h4>
                    <div class="mt-3 max-h-64 space-y-2 overflow-y-auto pr-2">
                      <p v-for="field in system.fields" :key="field.key" class="rounded-md bg-white/[0.04] p-2 text-sm text-mist">
                        <b class="text-white">{{ field.label }}</b> · {{ field.category }} · {{ field.type }} · padrao {{ field.defaultValue ?? '-' }}
                      </p>
                    </div>
                  </div>
                  <div class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <h4 class="font-black text-white">Comentarios recentes</h4>
                    <div class="mt-3 max-h-64 space-y-2 overflow-y-auto pr-2">
                      <p v-for="comment in system.comments" :key="comment.id" class="rounded-md bg-white/[0.04] p-2 text-sm text-mist">
                        <b class="text-white">{{ comment.user?.name || 'Jogador' }}:</b> {{ comment.content }}
                      </p>
                      <p v-if="!system.comments?.length" class="text-sm text-mist">Sem comentarios.</p>
                    </div>
                  </div>
                </div>
              </article>
              <div v-if="!visibleSystems.length" class="p-4">
                <EmptyState :icon="Swords" title="Nenhum sistema encontrado" description="Altere o filtro ou a busca para ver outros itens." />
              </div>
            </div>

            <div v-else class="divide-y divide-white/10">
              <article v-for="npc in visibleNpcs" :key="npc.id" class="p-4">
                <div class="grid gap-4 lg:grid-cols-[1fr_auto]">
                <button type="button" class="min-w-0 text-left" @click="toggleItem('npcs', npc.id)">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="kbd-chip">{{ statusText(npc.moderationStatus) }}</span>
                    <span class="kbd-chip">{{ npc.system?.name || 'Generico' }}</span>
                  </div>
                  <h3 class="mt-3 text-lg font-black text-white">{{ npc.name }}</h3>
                  <p class="mt-1 line-clamp-2 text-sm leading-6 text-mist">{{ npc.description || 'Sem descricao.' }}</p>
                  <p class="mt-2 text-xs text-mist">por {{ npc.createdBy?.name || 'Sem autor' }} · {{ npc.createdBy?.email || 'sem email' }} · {{ npc._count?.likes || 0 }} curtidas</p>
                </button>
                <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                  <AppButton variant="ghost" @click="setItemStatus('npcs', npc.id, 'APPROVED')"><CheckCircle2 class="h-4 w-4" />Aprovar</AppButton>
                  <AppButton variant="ghost" @click="setItemStatus('npcs', npc.id, 'REJECTED')"><XCircle class="h-4 w-4" />Rejeitar</AppButton>
                  <AppButton variant="danger" @click="deleteItem('npcs', npc.id)"><Trash2 class="h-4 w-4" />Apagar</AppButton>
                  <button type="button" class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-ember hover:bg-white/10" @click="toggleItem('npcs', npc.id)">
                    <ChevronDown class="h-5 w-5 transition" :class="isExpanded('npcs', npc.id) ? 'rotate-180' : ''" />
                  </button>
                </div>
                </div>
                <div v-if="isExpanded('npcs', npc.id)" class="mt-4 grid gap-4 border-t border-white/10 pt-4 lg:grid-cols-2">
                  <div class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <h4 class="font-black text-white">Dados completos</h4>
                    <pre class="mt-3 max-h-64 overflow-y-auto rounded-md bg-black/20 p-3 text-xs leading-5 text-mist">{{ JSON.stringify(npc.dataJson, null, 2) }}</pre>
                  </div>
                  <div class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <h4 class="font-black text-white">Comentarios recentes</h4>
                    <div class="mt-3 max-h-64 space-y-2 overflow-y-auto pr-2">
                      <p v-for="comment in npc.comments" :key="comment.id" class="rounded-md bg-white/[0.04] p-2 text-sm text-mist">
                        <b class="text-white">{{ comment.user?.name || 'Jogador' }}:</b> {{ comment.content }}
                      </p>
                      <p v-if="!npc.comments?.length" class="text-sm text-mist">Sem comentarios.</p>
                    </div>
                  </div>
                </div>
              </article>
              <div v-if="!visibleNpcs.length" class="p-4">
                <EmptyState :icon="Bot" title="Nenhum NPC encontrado" description="Altere o filtro ou a busca para ver outros itens." />
              </div>
            </div>
          </AppCard>
        </main>
      </div>
    </section>
    <ToastStack />
  </main>
</template>
