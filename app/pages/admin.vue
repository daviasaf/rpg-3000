<script setup lang="ts">
import { Bot, CheckCircle2, LogOut, ShieldCheck, Swords, Trash2, XCircle } from 'lucide-vue-next'

type Status = 'PENDING' | 'APPROVED' | 'REJECTED'
type AdminSystem = {
  id: string
  name: string
  description: string
  tags: string[]
  visibility: string
  moderationStatus: Status
  createdBy?: { name: string; email: string } | null
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
  _count?: { likes: number; comments: number }
}

const { push, apiError } = useToast()
const password = ref('')
const logged = ref(false)
const loading = ref(false)
const status = ref<Status>('PENDING')
const tab = ref<'systems' | 'npcs'>('systems')

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
</script>

<template>
  <main class="min-h-screen bg-void px-5 py-8 text-white">
    <div class="mx-auto max-w-6xl">
      <section v-if="!logged" class="grid min-h-[80vh] place-items-center">
        <form class="surface w-full max-w-md rounded-xl p-6" @submit.prevent="login">
          <div class="flex items-center gap-3">
            <div class="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-ember to-flare text-black">
              <ShieldCheck class="h-6 w-6" />
            </div>
            <div>
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

      <section v-else class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.18em] text-ember">Central RPG 3000</p>
            <h1 class="mt-1 text-3xl font-black">Painel de analise</h1>
            <p class="mt-1 text-mist">Aprove, rejeite ou remova sistemas e NPCs da comunidade.</p>
          </div>
          <AppButton variant="ghost" @click="logout"><LogOut class="h-4 w-4" />Sair</AppButton>
        </div>

        <AppCard>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex gap-2">
              <button type="button" class="rounded-lg border px-3 py-2 text-sm font-black" :class="tab === 'systems' ? 'border-ember bg-ember/15 text-ember' : 'border-white/10 text-mist'" @click="tab = 'systems'">
                <Swords class="mr-2 inline h-4 w-4" />Sistemas
              </button>
              <button type="button" class="rounded-lg border px-3 py-2 text-sm font-black" :class="tab === 'npcs' ? 'border-ember bg-ember/15 text-ember' : 'border-white/10 text-mist'" @click="tab = 'npcs'">
                <Bot class="mr-2 inline h-4 w-4" />NPCs
              </button>
            </div>
            <select v-model="status" class="select max-w-48">
              <option value="PENDING">Em analise</option>
              <option value="APPROVED">Aprovados</option>
              <option value="REJECTED">Rejeitados</option>
            </select>
          </div>
        </AppCard>

        <div v-if="tab === 'systems'" class="grid gap-4 lg:grid-cols-2">
          <AppCard v-for="system in data?.systems" :key="system.id">
            <div>
                <p class="text-xs font-black uppercase text-ember">{{ system.visibility }} | {{ system.moderationStatus }}</p>
                <h2 class="mt-1 text-xl font-black">{{ system.name }}</h2>
                <p class="mt-2 text-sm leading-6 text-mist">{{ system.description }}</p>
                <p class="mt-2 text-xs text-mist">por {{ system.createdBy?.name || 'Sem autor' }} | {{ system.createdBy?.email }}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span v-for="tag in system.tags" :key="tag" class="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-bold text-mist">{{ tag }}</span>
                </div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <AppButton variant="ghost" @click="setItemStatus('systems', system.id, 'APPROVED')"><CheckCircle2 class="h-4 w-4" />Aprovar</AppButton>
              <AppButton variant="ghost" @click="setItemStatus('systems', system.id, 'REJECTED')"><XCircle class="h-4 w-4" />Rejeitar</AppButton>
              <AppButton variant="danger" @click="deleteItem('systems', system.id)"><Trash2 class="h-4 w-4" />Apagar</AppButton>
            </div>
          </AppCard>
        </div>

        <div v-if="tab === 'npcs'" class="grid gap-4 lg:grid-cols-2">
          <AppCard v-for="npc in data?.npcs" :key="npc.id">
            <div>
                <p class="text-xs font-black uppercase text-ember">{{ npc.system?.name || 'Generico' }} | {{ npc.moderationStatus }}</p>
                <h2 class="mt-1 text-xl font-black">{{ npc.name }}</h2>
                <p class="mt-2 text-sm leading-6 text-mist">{{ npc.description || 'Sem descricao.' }}</p>
                <p class="mt-2 text-xs text-mist">por {{ npc.createdBy?.name || 'Sem autor' }} | {{ npc.createdBy?.email }}</p>
                <div v-if="Array.isArray(npc.dataJson.attacks)" class="mt-3 flex flex-wrap gap-2">
                  <span v-for="attack in npc.dataJson.attacks" :key="String((attack as Record<string, unknown>).name)" class="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-bold text-mist">
                    {{ (attack as Record<string, unknown>).name }}: {{ (attack as Record<string, unknown>).damage }}
                  </span>
                </div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <AppButton variant="ghost" @click="setItemStatus('npcs', npc.id, 'APPROVED')"><CheckCircle2 class="h-4 w-4" />Aprovar</AppButton>
              <AppButton variant="ghost" @click="setItemStatus('npcs', npc.id, 'REJECTED')"><XCircle class="h-4 w-4" />Rejeitar</AppButton>
              <AppButton variant="danger" @click="deleteItem('npcs', npc.id)"><Trash2 class="h-4 w-4" />Apagar</AppButton>
            </div>
          </AppCard>
        </div>
      </section>
    </div>
    <ToastStack />
  </main>
</template>
