<script setup lang="ts">
import type { DynamicField } from '../../shared/types/system'

const props = defineProps<{
  field: DynamicField
  modelValue: unknown
  readonly?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

function update(next: unknown) {
  emit('update:modelValue', next)
}

const options = computed(() => {
  if (Array.isArray(props.field.optionsJson)) return props.field.optionsJson.map(String)
  if (typeof props.field.optionsJson === 'string') return props.field.optionsJson.split(',').map((item) => item.trim()).filter(Boolean)
  return []
})
</script>

<template>
  <label class="block">
    <span class="label">{{ field.label }}</span>
    <textarea
      v-if="field.type === 'TEXT'"
      :value="String(modelValue ?? '')"
      :readonly="readonly"
      rows="4"
      class="input min-h-28 resize-y"
      @input="update(($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else-if="field.type === 'NUMBER' || field.type === 'FORMULA' || field.type === 'DICE'"
      :value="modelValue as number | string"
      :readonly="readonly"
      :type="field.type === 'NUMBER' ? 'number' : 'text'"
      class="input"
      @input="update(field.type === 'NUMBER' ? Number(($event.target as HTMLInputElement).value) : ($event.target as HTMLInputElement).value)"
    >
    <select v-else-if="field.type === 'LIST'" :value="String(modelValue ?? '')" :disabled="readonly" class="select" @change="update(($event.target as HTMLSelectElement).value)">
      <option v-for="option in options" :key="option" :value="option">{{ option }}</option>
    </select>
    <div v-else-if="field.type === 'BOOLEAN'" class="flex h-[42px] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-3">
      <input :id="field.key" :checked="Boolean(modelValue)" :disabled="readonly" type="checkbox" class="h-4 w-4 accent-ember" @change="update(($event.target as HTMLInputElement).checked)">
      <span class="text-sm text-mist">{{ modelValue ? 'Sim' : 'Nao' }}</span>
    </div>
    <input v-else :value="String(modelValue ?? '')" :readonly="readonly" class="input" @input="update(($event.target as HTMLInputElement).value)">
  </label>
</template>
