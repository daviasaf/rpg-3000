<script setup lang="ts">
import { Dice5 } from 'lucide-vue-next'
import type { FormulaVariable } from '../../shared/utils/characterRules'

const props = defineProps<{
  roomId?: string
  characterId?: string | null
  isMaster?: boolean
  variables?: FormulaVariable[]
}>()

const emit = defineEmits<{ rolled: [] }>()
const { push, apiError } = useToast()
const expression = ref('1d20')
const hidden = ref(false)
const loading = ref(false)

const presets = ['1d20', '1d12', '1d8', '1d6', '1d4']

async function roll() {
  if (!props.roomId) return
  loading.value = true
  try {
    const response = await $fetch<{ roll: { result: number } }>(`/api/rooms/${props.roomId}/roll`, {
      method: 'POST',
      body: { expression: expression.value, mode: 'NORMAL', characterId: props.characterId, hidden: props.isMaster ? hidden.value : false }
    })
    push(`Rolagem: ${response.roll.result}`, 'success')
    emit('rolled')
  } catch (error) {
    apiError(error, 'Nao foi possivel rolar os dados.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AppCard>
    <h3 class="mb-4 flex items-center gap-2 text-lg font-black text-white"><Dice5 class="h-5 w-5 text-ember" /> Rolagem</h3>
    <div class="space-y-3">
      <FormulaTextInput v-model="expression" :variables="props.variables || []" placeholder="1d20, 1d12, 2d20+5" />
      <div class="flex flex-wrap gap-2">
        <button v-for="preset in presets" :key="preset" type="button" class="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-mist hover:border-ember/40 hover:text-white" @click="expression = preset">
          {{ preset }}
        </button>
      </div>
      <label v-if="isMaster" class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <input v-model="hidden" type="checkbox" class="h-4 w-4 accent-ember">
        <span class="text-sm font-bold text-white">Esconder rolagem do mestre</span>
      </label>
      <AppButton class="w-full" :loading="loading" @click="roll">Rolar</AppButton>
    </div>
  </AppCard>
</template>

