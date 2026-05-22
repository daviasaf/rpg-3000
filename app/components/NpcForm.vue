<script setup lang="ts">
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-vue-next'

type AttackDraft = { name: string; damage: string; description: string }
type NpcDraft = {
  id?: string
  name?: string
  description?: string | null
  avatarUrl?: string | null
  systemId?: string | null
  isCommunity?: boolean
  moderationStatus?: string | null
  moderationReason?: string | null
  dataJson?: Record<string, unknown> | null
}

const props = withDefaults(defineProps<{
  mode?: 'create' | 'edit'
  npc?: NpcDraft | null
}>(), {
  mode: 'create',
  npc: null
})

const { push, apiError } = useToast()
const { data: systems } = await useFetch<{ systems: Array<{ id: string; name: string }> }>('/api/systems')
const loading = ref(false)
const saveIntentOpen = ref(false)
const isRejected = computed(() => props.npc?.moderationStatus === 'REJECTED')

const form = reactive({
  name: props.npc?.name || '',
  description: props.npc?.description || '',
  avatarUrl: props.npc?.avatarUrl || '',
  systemId: props.npc?.systemId || '',
  isCommunity: Boolean(props.npc?.isCommunity),
  vida: Number(props.npc?.dataJson?.vida ?? 10),
  ataque: Number(props.npc?.dataJson?.ataque ?? 1),
  attacks: normalizeAttacks(props.npc?.dataJson?.attacks)
})

function normalizeAttacks(value: unknown): AttackDraft[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ name: 'Ataque basico', damage: '1d6', description: '' }]
  }

  return value.map((attack) => {
    const item = attack as Record<string, unknown>
    return {
      name: String(item.name || ''),
      damage: String(item.damage || '1d6'),
      description: String(item.description || '')
    }
  })
}

function addAttack() {
  form.attacks.push({ name: '', damage: '1d6', description: '' })
}

function removeAttack(index: number) {
  form.attacks.splice(index, 1)
}

async function submit(publish = false) {
  if (isRejected.value) return
  loading.value = true
  try {
    const body = {
      name: form.name,
      description: form.description,
      avatarUrl: form.avatarUrl,
      systemId: form.systemId || null,
      isCommunity: publish,
      dataJson: {
        vida: form.vida,
        ataque: form.ataque,
        attacks: form.attacks.filter((attack) => attack.name.trim())
      }
    }

    if (props.mode === 'edit' && props.npc?.id) {
      await $fetch(`/api/npcs/${props.npc.id}`, { method: 'PUT', body })
      push(publish ? 'NPC salvo e enviado para analise.' : 'NPC salvo.', 'success')
      await navigateTo(`/app/npcs/${props.npc.id}`)
    } else {
      await $fetch('/api/npcs', { method: 'POST', body })
      push(publish ? 'NPC salvo e enviado para analise.' : 'NPC salvo.', 'success')
      await navigateTo('/app/npcs')
    }
  } catch (error) {
    apiError(error, props.mode === 'edit' ? 'Nao foi possivel editar NPC.' : 'Nao foi possivel criar NPC.')
  } finally {
    loading.value = false
    saveIntentOpen.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <NuxtLink to="/app/npcs" class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-mist hover:text-white">
      <ArrowLeft class="h-4 w-4" />
      Voltar
    </NuxtLink>

    <div>
      <h1 class="page-title">{{ mode === 'edit' ? 'Editar NPC' : 'Criar NPC' }}</h1>
      <p class="muted mt-1">Monte um NPC para seu inventario ou publique uma copia na comunidade.</p>
    </div>

    <AppCard v-if="isRejected" class="border-flare/40 bg-flare/10">
      <h2 class="font-black text-white">NPC rejeitado</h2>
      <p class="mt-2 text-sm text-red-100">{{ npc?.moderationReason || 'Este NPC esta bloqueado para edicao. Crie uma nova versao para enviar novamente.' }}</p>
    </AppCard>

    <AppCard>
      <form class="grid gap-4 md:grid-cols-2 xl:grid-cols-4" @submit.prevent="saveIntentOpen = true">
        <label><span class="label">Nome *</span><input v-model="form.name" class="input" type="text" :disabled="isRejected"></label>
        <label><span class="label">Sistema</span><select v-model="form.systemId" class="select" :disabled="isRejected"><option value="">{{ systems?.systems.length ? 'Generico' : 'Nenhum sistema criado ainda' }}</option><option v-for="system in systems?.systems" :key="system.id" :value="system.id">{{ system.name }}</option></select></label>
        <label><span class="label">Vida *</span><input v-model.number="form.vida" class="input" type="number" :disabled="isRejected"></label>
        <label><span class="label">Ataque *</span><input v-model.number="form.ataque" class="input" type="number" :disabled="isRejected"></label>
        <label class="md:col-span-2"><span class="label">Avatar por URL</span><input v-model="form.avatarUrl" class="input" type="url" placeholder="https://..." :disabled="isRejected"></label>
        <label class="md:col-span-2"><span class="label">Descricao</span><input v-model="form.description" class="input" type="text" :disabled="isRejected"></label>
        <div class="md:col-span-2 xl:col-span-4">
          <div class="mb-2 flex items-center justify-between gap-3">
            <h2 class="font-black text-white">Ataques especificos</h2>
            <button type="button" class="rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-white hover:border-ember/40 disabled:opacity-50" :disabled="isRejected" @click="addAttack">Adicionar ataque</button>
          </div>
          <div class="space-y-2">
            <div v-for="(attack, index) in form.attacks" :key="index" class="grid gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-3 md:grid-cols-[1fr_160px_1fr_auto]">
              <input v-model="attack.name" class="input" placeholder="Nome do ataque" :disabled="isRejected">
              <input v-model="attack.damage" class="input" placeholder="1d6+2" :disabled="isRejected">
              <input v-model="attack.description" class="input" placeholder="Efeito, alcance, condicao..." :disabled="isRejected">
              <button type="button" class="rounded-lg border border-flare/30 p-2 text-flare hover:bg-flare/10 disabled:opacity-50" title="Remover ataque" :disabled="isRejected" @click="removeAttack(index)"><Trash2 class="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        <div class="md:col-span-2 xl:col-span-4">
          <AppButton :loading="loading" type="submit" :disabled="isRejected">
            <Save v-if="mode === 'edit'" class="h-4 w-4" />
            <Plus v-else class="h-4 w-4" />
            {{ mode === 'edit' ? 'Salvar NPC' : 'Criar NPC' }}
          </AppButton>
        </div>
      </form>
    </AppCard>
    <SavePublishModal
      :open="saveIntentOpen"
      title="Salvar NPC"
      message="Salvar mantem o NPC no seu inventario. Salvar e postar cria um snapshot para analise da comunidade."
      :loading="loading"
      @close="saveIntentOpen = false"
      @save="submit(false)"
      @publish="submit(true)"
    />
  </div>
</template>
