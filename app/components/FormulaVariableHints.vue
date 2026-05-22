<script setup lang="ts">
import type { FormulaVariable } from '../../shared/utils/characterRules'

const props = withDefaults(defineProps<{
  variables: FormulaVariable[]
  modelValue?: string
  dense?: boolean
}>(), {
  modelValue: '',
  dense: false
})

const emit = defineEmits<{ insert: [key: string] }>()

const visibleVariables = computed(() => {
  const token = String(props.modelValue || '').split(/[^A-Za-z0-9_]+/).pop()?.toUpperCase() || ''
  const source = token
    ? props.variables.filter((variable) => variable.key.includes(token) || variable.label.toUpperCase().includes(token))
    : props.variables
  return source.slice(0, props.dense ? 6 : 10)
})
</script>

<template>
  <div v-if="visibleVariables.length" :class="dense ? 'space-y-1' : 'rounded-lg border border-white/10 bg-white/[0.035] p-2'">
    <div :class="dense ? 'flex items-center gap-2' : 'mb-2 flex items-center justify-between gap-2'">
      <span :class="dense ? 'text-[9px] font-black uppercase tracking-[0.12em] text-mist/80' : 'text-[10px] font-black uppercase tracking-[0.12em] text-mist'">Variaveis</span>
      <span :class="dense ? 'text-[9px] font-bold text-mist/60' : 'text-[10px] font-bold text-mist'">{{ variables.length }}</span>
    </div>
    <div class="flex flex-wrap gap-1">
      <button
        v-for="variable in visibleVariables"
        :key="variable.key"
        type="button"
        class="rounded-md border border-white/10 px-1.5 py-0.5 text-left text-[10px] font-bold text-mist transition hover:border-ember/40 hover:text-white"
        :class="dense ? 'bg-white/[0.035]' : 'bg-panel/70'"
        :title="`${variable.key} - ${variable.label} - ${variable.type}`"
        @click="emit('insert', variable.key)"
      >
        <span class="font-mono text-ember">{{ variable.key }}</span>
        <span v-if="!dense" class="mx-1 text-white/30">-</span>
        <span v-if="!dense">{{ variable.label }}</span>
        <span v-if="!dense" class="ml-1 text-white/35">{{ variable.type }}</span>
      </button>
    </div>
  </div>
</template>
