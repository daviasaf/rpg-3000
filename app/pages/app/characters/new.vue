<script setup lang="ts">
import type { DynamicField, SystemSchema } from '../../../../shared/types/system'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const { push, apiError } = useToast()
const { data: systems } = await useFetch<{ systems: Array<{ id: string; name: string; schemaJson?: SystemSchema; fields: DynamicField[] }> }>('/api/systems')
const selectedSystemId = ref(String(route.query.systemId || systems.value?.systems[0]?.id || ''))
const form = reactive({ name: '', description: '', avatarUrl: '' })
const progression = reactive({ classKey: '', level: 1 })
const dataJson = reactive<Record<string, unknown>>({})
const loading = ref(false)
const formErrors = ref<string[]>([])

const selectedSystem = computed(() => systems.value?.systems.find((system) => system.id === selectedSystemId.value))
const systemClasses = computed(() => selectedSystem.value?.schemaJson?.classes || [])
const selectedClass = computed(() => systemClasses.value.find((item) => item.key === progression.classKey))
const attributeFields = computed(() => selectedSystem.value?.fields.filter((field) => field.category === 'ATTRIBUTE') || [])
const editableFields = computed(() => selectedSystem.value?.fields.filter((field) => field.category !== 'ATTRIBUTE') || [])
const levelRules = computed(() => selectedSystem.value?.schemaJson?.leveling || {})
const attributeBudget = computed(() => Number(levelRules.value.levelOneAttributePoints ?? 6) + Math.max(0, progression.level - 1) * Number(levelRules.value.attributesPerLevel ?? 1))
const attributeLimit = computed(() => {
  const levelOneLimit = Number(levelRules.value.levelOneAttributeLimit ?? 5)
  const increase = Math.max(0, progression.level - 1) * Number(levelRules.value.attributeLimitIncreasePerLevel ?? 1)
  const cap = Number(levelRules.value.maxAttributeLimit ?? 20)
  return Math.min(cap, levelOneLimit + increase)
})
const spentAttributes = computed(() => attributeFields.value.reduce((sum, field) => sum + Number(dataJson[field.key] || 0), 0))
const effectiveAttributeBudget = computed(() => Math.min(attributeBudget.value, attributeFields.value.length * attributeLimit.value))
const remainingAttributes = computed(() => effectiveAttributeBudget.value - spentAttributes.value)
const selectedClassChanges = computed(() => {
  if (!selectedClass.value) return []
  return selectedClass.value.levels
    .filter((level) => level.level <= progression.level)
    .flatMap((level) => level.changes.map((change) => ({ ...change, level: level.level })))
})

watch(selectedSystem, (system) => {
  if (!system) return
  for (const field of system.fields) {
    if (!(field.key in dataJson)) dataJson[field.key] = field.defaultValue ?? ''
  }
  for (const field of system.fields.filter((item) => item.category === 'ATTRIBUTE')) {
    dataJson[field.key] = Number(dataJson[field.key] || 0)
  }
  progression.classKey = system.schemaJson?.classes?.[0]?.key || ''
  progression.level = 1
}, { immediate: true })

watch(selectedClass, (rpgClass) => {
  if (!rpgClass) return
  progression.level = Math.max(1, Math.min(Number(progression.level || 1), rpgClass.maxLevel))
})

async function submit() {
  formErrors.value = validateCharacterDraft()
  if (formErrors.value.length) {
    push('Complete a ficha antes de salvar.', 'error')
    return
  }

  loading.value = true
  try {
    const response = await $fetch<{ character: { id: string } }>('/api/characters', {
      method: 'POST',
      body: { ...form, systemId: selectedSystemId.value, dataJson: buildCharacterData() }
    })
    push('Personagem criado.', 'success')
    await navigateTo('/app/characters')
  } catch (error) {
    apiError(error, 'Nao foi possivel criar personagem.')
  } finally {
    loading.value = false
  }
}

function buildCharacterData() {
  const next: Record<string, unknown> = { ...dataJson }
  const rpgClass = selectedClass.value

  if (!rpgClass) return next

  next.classe = rpgClass.key
  next.nivel = Math.max(1, Math.min(Number(progression.level || 1), rpgClass.maxLevel))

  for (const level of rpgClass.levels.filter((item) => item.level <= Number(next.nivel))) {
    for (const change of level.changes) {
      if (change.operation === 'SET') {
        next[change.targetKey] = change.value
      } else {
        next[change.targetKey] = Number(next[change.targetKey] || 0) + Number(change.value || 0)
      }
    }
  }

  return next
}

function setAttribute(key: string, delta: number) {
  const current = Number(dataJson[key] || 0)
  const next = current + delta
  if (next < 0 || next > attributeLimit.value) return
  if (delta > 0 && remainingAttributes.value <= 0) return
  dataJson[key] = next
}

function changeLevel(delta: number) {
  const max = selectedClass.value?.maxLevel || 100
  progression.level = Math.max(1, Math.min(max, Number(progression.level || 1) + delta))
}

function validateCharacterDraft() {
  const errors: string[] = []
  if (!form.name.trim()) errors.push('Informe o nome do personagem.')
  if (attributeFields.value.length && remainingAttributes.value !== 0) {
    errors.push(`Distribua exatamente ${effectiveAttributeBudget.value} pontos de atributo.`)
  }
  if (systemClasses.value.length && !progression.classKey) errors.push('Escolha uma classe.')
  for (const field of editableFields.value) {
    if (['FORMULA', 'ROLL_RULE', 'BOOLEAN_FIELD'].includes(field.category)) continue
    const value = dataJson[field.key]
    if (field.type === 'BOOLEAN') continue
    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push(`Preencha ${field.label}.`)
    }
  }
  return errors
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="page-title">Novo personagem</h1>
      <p class="muted mt-1">Escolha um sistema e a ficha sera montada automaticamente.</p>
    </div>
    <form class="space-y-5" @submit.prevent="submit">
      <AppCard>
        <h2 class="mb-4 text-xl font-black text-white">Identidade</h2>
        <div class="grid gap-4">
          <label><span class="label">Sistema</span><select v-model="selectedSystemId" class="select"><option v-for="system in systems?.systems" :key="system.id" :value="system.id">{{ system.name }}</option></select></label>
          <label><span class="label">Nome</span><input v-model="form.name" name="characterName" class="input" type="text"></label>
          <label><span class="label">Avatar por URL</span><input v-model="form.avatarUrl" name="avatarUrl" class="input" type="url" placeholder="https://..."></label>
          <label><span class="label">Descricao curta</span><textarea v-model="form.description" rows="3" class="input" /></label>
        </div>
      </AppCard>
      <AppCard v-if="formErrors.length" class="border-flare/40 bg-flare/10">
        <h2 class="text-lg font-black text-white">Antes de salvar:</h2>
        <ul class="mt-3 space-y-2 text-sm text-red-100">
          <li v-for="error in formErrors" :key="error">{{ error }}</li>
        </ul>
      </AppCard>
      <AppCard v-if="attributeFields.length">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-black text-white">Atributos</h2>
            <p class="muted mt-1">Distribua os pontos permitidos pelo sistema. Depois de criado, atributo nao fica livre para editar.</p>
          </div>
          <div class="rounded-lg border border-ember/25 bg-ember/10 px-3 py-2 text-sm font-black text-ember">
            {{ remainingAttributes }} restantes / {{ effectiveAttributeBudget }} total
          </div>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="field in attributeFields" :key="field.key" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <span class="label">{{ field.label }}</span>
            <div class="flex items-center gap-2">
              <button type="button" class="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white hover:border-ember/40" @click="setAttribute(field.key, -1)">-</button>
              <div class="input grid h-10 place-items-center px-0 text-center font-black">{{ dataJson[field.key] || 0 }}</div>
              <button type="button" class="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white hover:border-ember/40" @click="setAttribute(field.key, 1)">+</button>
            </div>
            <p class="mt-2 text-xs text-mist">Limite atual: {{ attributeLimit }}</p>
          </div>
        </div>
      </AppCard>
      <AppCard v-if="systemClasses.length">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-black text-white">Classe e nivel</h2>
            <p class="muted mt-1">Use os controles para subir ou baixar o nivel inicial antes de salvar.</p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-white">
            Nivel {{ progression.level }}
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label>
            <span class="label">Classe</span>
            <select v-model="progression.classKey" class="select">
              <option v-for="rpgClass in systemClasses" :key="rpgClass.key" :value="rpgClass.key">{{ rpgClass.name }}</option>
            </select>
          </label>
          <label>
            <span class="label">Nivel inicial</span>
            <div class="grid grid-cols-[42px_1fr_42px] gap-2">
              <button type="button" class="rounded-lg border border-white/10 text-white hover:border-ember/40" @click="changeLevel(-1)">-</button>
              <input v-model.number="progression.level" type="number" min="1" :max="selectedClass?.maxLevel || 100" class="input text-center font-black">
              <button type="button" class="rounded-lg border border-white/10 text-white hover:border-ember/40" @click="changeLevel(1)">+</button>
            </div>
          </label>
        </div>
        <div v-if="selectedClassChanges.length" class="mt-4 max-h-44 space-y-2 overflow-y-auto pr-2">
          <p v-for="(change, index) in selectedClassChanges" :key="index" class="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-sm text-mist">
            Nivel {{ change.level }}: {{ change.operation === 'ADD' ? '+' : '=' }}{{ change.value }} em {{ change.targetLabel || change.targetKey }}
          </p>
        </div>
      </AppCard>
      <AppCard v-if="selectedSystem">
        <h2 class="mb-4 text-xl font-black text-white">Campos da ficha</h2>
        <div class="grid gap-4 md:grid-cols-2">
          <DynamicFieldRenderer v-for="field in editableFields" :key="field.key" v-model="dataJson[field.key]" :field="field" />
        </div>
      </AppCard>
      <AppButton type="submit" :loading="loading">Salvar personagem</AppButton>
    </form>
  </div>
</template>
