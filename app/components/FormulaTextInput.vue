<script setup lang="ts">
import type { FormulaVariable } from '../../shared/utils/characterRules'

const props = withDefaults(defineProps<{
  modelValue?: string
  variables: FormulaVariable[]
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  dense?: boolean
}>(), {
  modelValue: '',
  placeholder: '',
  disabled: false,
  readonly: false,
  dense: true
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const inputRef = ref<HTMLInputElement | null>(null)

function update(value: string) {
  emit('update:modelValue', value)
}

function insertVariable(key: string) {
  const input = inputRef.value
  const value = String(props.modelValue || '')
  const cursor = input?.selectionStart ?? value.length
  const endCursor = input?.selectionEnd ?? cursor
  const start = findTokenStart(value, cursor)
  const end = findTokenEnd(value, endCursor)
  const next = `${value.slice(0, start)}${key}${value.slice(end)}`
  const nextCursor = start + key.length
  emit('update:modelValue', next)
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.setSelectionRange(nextCursor, nextCursor)
  })
}

function findTokenStart(value: string, cursor: number) {
  let index = cursor
  while (index > 0 && /[A-Za-z0-9_]/.test(value[index - 1] || '')) index -= 1
  return index
}

function findTokenEnd(value: string, cursor: number) {
  let index = cursor
  while (index < value.length && /[A-Za-z0-9_]/.test(value[index] || '')) index += 1
  return index
}
</script>

<template>
  <div class="space-y-2">
    <input
      ref="inputRef"
      :value="modelValue"
      class="input"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      @input="update(($event.target as HTMLInputElement).value)"
    >
    <FormulaVariableHints
      v-if="variables.length && !readonly && !disabled"
      :dense="dense"
      :variables="variables"
      :model-value="modelValue"
      @insert="insertVariable"
    />
  </div>
</template>

