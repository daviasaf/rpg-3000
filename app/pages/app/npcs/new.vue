<script setup lang="ts">
import { ArrowLeft, Plus, Trash2 } from 'lucide-vue-next'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { push, apiError } = useToast()
const { data: systems } = await useFetch<{ systems: Array<{ id: string; name: string }> }>('/api/systems')

const form = reactive({
  name: '',
  description: '',
  avatarUrl: '',
  systemId: '',
  isCommunity: false,
  vida: 10,
  ataque: 1,
  attacks: [{ name: 'Ataque basico', damage: '1d6', description: '' }]
})
const loading = ref(false)

function addAttack() {
  form.attacks.push({ name: '', damage: '1d6', description: '' })
}

function removeAttack(index: number) {
  form.attacks.splice(index, 1)
}

async function createNpc() {
  loading.value = true
  try {
    await $fetch('/api/npcs', {
      method: 'POST',
      body: {
        name: form.name,
        description: form.description,
        avatarUrl: form.avatarUrl,
        systemId: form.systemId || null,
        isCommunity: form.isCommunity,
        dataJson: { vida: form.vida, ataque: form.ataque, attacks: form.attacks.filter((attack) => attack.name.trim()) }
      }
    })
    push(form.isCommunity ? 'NPC enviado para analise.' : 'NPC criado.', 'success')
    await navigateTo('/app/npcs')
  } catch (error) {
    apiError(error, 'Nao foi possivel criar NPC.')
  } finally {
    loading.value = false
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
      <h1 class="page-title">Criar NPC</h1>
      <p class="muted mt-1">Monte um NPC para seu inventario ou publique uma copia na comunidade.</p>
    </div>

    <AppCard>
      <form class="grid gap-4 md:grid-cols-2 xl:grid-cols-4" @submit.prevent="createNpc">
        <label><span class="label">Nome *</span><input v-model="form.name" class="input" type="text"></label>
        <label><span class="label">Sistema</span><select v-model="form.systemId" class="select"><option value="">{{ systems?.systems.length ? 'Generico' : 'Nenhum sistema criado ainda' }}</option><option v-for="system in systems?.systems" :key="system.id" :value="system.id">{{ system.name }}</option></select></label>
        <label><span class="label">Vida *</span><input v-model.number="form.vida" class="input" type="number"></label>
        <label><span class="label">Ataque *</span><input v-model.number="form.ataque" class="input" type="number"></label>
        <label class="md:col-span-2"><span class="label">Avatar por URL</span><input v-model="form.avatarUrl" class="input" type="url" placeholder="https://..."></label>
        <label class="md:col-span-2"><span class="label">Descricao</span><input v-model="form.description" class="input" type="text"></label>
        <label class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3"><input v-model="form.isCommunity" type="checkbox" class="h-4 w-4 accent-ember"><span class="font-bold text-white">Publicar na comunidade</span></label>
        <div class="md:col-span-2 xl:col-span-4">
          <div class="mb-2 flex items-center justify-between gap-3">
            <h2 class="font-black text-white">Ataques especificos</h2>
            <button type="button" class="rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-white hover:border-ember/40" @click="addAttack">Adicionar ataque</button>
          </div>
          <div class="space-y-2">
            <div v-for="(attack, index) in form.attacks" :key="index" class="grid gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-3 md:grid-cols-[1fr_160px_1fr_auto]">
              <input v-model="attack.name" class="input" placeholder="Nome do ataque">
              <input v-model="attack.damage" class="input" placeholder="1d6+2">
              <input v-model="attack.description" class="input" placeholder="Efeito, alcance, condicao...">
              <button type="button" class="rounded-lg border border-flare/30 p-2 text-flare hover:bg-flare/10" title="Remover ataque" @click="removeAttack(index)"><Trash2 class="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        <div class="md:col-span-2 xl:col-span-4"><AppButton :loading="loading" type="submit"><Plus class="h-4 w-4" />Criar NPC</AppButton></div>
      </form>
    </AppCard>
  </div>
</template>
