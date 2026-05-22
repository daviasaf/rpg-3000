<script setup lang="ts">
import type { DynamicField, SheetTab, SheetTabRecord, SystemSchema } from '../../../../shared/types/system'
import { formulaKeyFromLabel, keyFromLabel, normalizeSheetTabs, sheetTabTypeLabels } from '~~/shared/utils/sheetTabs'
import { attributeBudgetForLevel, attributeLimitForLevel, initialLevelForSchema, progressionTotals, resolveNumericDefault, validateCharacterData } from '~~/shared/utils/characterRules'
import { applyClassProgression } from '../../../utils/characterProgression'

definePageMeta({ layout: 'app', middleware: 'auth' })

type TabItem = {
  id: string
  sourceRecordKey?: string
  name: string
  description: string
  damage?: string
  weight?: number | null
  roll?: string
  cost?: string
  range?: string
  ability?: string
  bonus?: string
  effect?: string
  quantity?: number | null
  fields: Record<string, unknown>
}

type TabRecordValue = {
  name?: string
  value?: unknown
  current?: unknown
  max?: unknown
  text?: string
  description?: string
  relatedAttribute?: string
  roll?: string
  selected?: boolean
  levelKey?: string
}

const route = useRoute()
const { push, apiError } = useToast()

const { data: systems } = await useFetch<{
  systems: Array<{
    id: string
    name: string
    schemaJson?: SystemSchema
    fields: DynamicField[]
  }>
}>('/api/systems?mine=true')

const selectedSystemId = ref(String(route.query.systemId || systems.value?.systems[0]?.id || ''))
const form = reactive({ name: '', description: '', avatarUrl: '' })
const saveIntentOpen = ref(false)
const progression = reactive({ classKey: '', level: 0 })
const dataJson = reactive<Record<string, unknown>>({})
const loading = ref(false)
const formErrors = ref<string[]>([])

const selectedSystem = computed(() => systems.value?.systems.find((system) => system.id === selectedSystemId.value))
const systemClasses = computed(() => selectedSystem.value?.schemaJson?.classes || [])
const systemTabs = computed(() => normalizeSheetTabs(selectedSystem.value?.schemaJson))
const selectedClass = computed(() => systemClasses.value.find((item) => item.key === progression.classKey))

const tabRecordFieldKeys = computed(() => new Set(
  systemTabs.value.flatMap((tab) => (tab.records || []).map((record) => formulaKeyFromLabel(record.key || record.name)))
))

const attributeFields = computed(() => selectedSystem.value?.fields.filter((field) => field.category === 'ATTRIBUTE') || [])
const editableFields = computed(() => selectedSystem.value?.fields.filter((field) => field.category !== 'ATTRIBUTE' && !tabRecordFieldKeys.value.has(formulaKeyFromLabel(field.key))) || [])
const editableSheetTabs = computed(() => systemTabs.value.filter((tab) => !['ATTRIBUTES', 'CLASS_PROGRESS'].includes(tab.type)))

const rulesTotals = computed(() => progressionTotals(selectedSystem.value?.schemaJson, progression.level, progression.classKey))
const attributeBudget = computed(() => attributeBudgetForLevel(selectedSystem.value?.schemaJson, progression.level))
const attributeLimit = computed(() => attributeLimitForLevel(selectedSystem.value?.schemaJson, progression.level))
const spentAttributes = computed(() => attributeFields.value.reduce((sum, field) => sum + Number(dataJson[field.key] || 0), 0))
const effectiveAttributeBudget = computed(() => Math.min(attributeBudget.value, attributeFields.value.length * attributeLimit.value))
const remainingAttributes = computed(() => effectiveAttributeBudget.value - spentAttributes.value)

const selectedWeight = computed(() => systemTabs.value
  .filter((tab) => ['ITEMS', 'WEAPONS'].includes(tab.type))
  .flatMap((tab) => tabItems(tab).map((item) => Number(item.weight || recordByItem(tab, item)?.weight || 0)))
  .reduce((sum, weight) => sum + weight, 0))

const remainingWeight = computed(() => Math.max(0, Number(rulesTotals.value.inventoryCapacity || 0) - selectedWeight.value))

const selectedClassChanges = computed(() => {
  if (!selectedClass.value) return []

  return selectedClass.value.levels
    .filter((level) => level.level <= progression.level)
    .flatMap((level) => level.changes.map((change) => ({ ...change, level: level.level })))
})

const previewDataJson = computed(() => buildCharacterData())

watch(selectedSystem, (system) => {
  if (!system) return

  for (const key of Object.keys(dataJson)) delete dataJson[key]

  for (const field of system.fields) {
    if (!(field.key in dataJson)) {
      dataJson[field.key] = field.category === 'ATTRIBUTE'
        ? resolveNumericDefault(field.defaultValue, new Map(Object.entries(dataJson).map(([key, value]) => [formulaKeyFromLabel(key), String(Number(value || 0))])))
        : field.defaultValue ?? ''
    }
  }

  for (const tab of normalizeSheetTabs(system.schemaJson)) {
    initializeTabData(tab)
  }

  for (const field of system.fields.filter((item) => item.category === 'ATTRIBUTE')) {
    dataJson[field.key] = Number(dataJson[field.key] || 0)
  }

  progression.classKey = system.schemaJson?.classes?.[0]?.key || ''
  progression.level = initialLevelForSchema(system.schemaJson)
}, { immediate: true })

watch(selectedClass, (rpgClass) => {
  if (!rpgClass) return
  progression.level = Math.max(initialLevelForSchema(selectedSystem.value?.schemaJson), Math.min(Number(progression.level ?? 0), rpgClass.maxLevel))
})

async function submit(publish = false) {
  formErrors.value = validateCharacterDraft()

  if (formErrors.value.length) {
    push('Complete a ficha antes de salvar.', 'error')
    return
  }

  loading.value = true

  try {
    const response = await $fetch<{ character: { id: string } }>('/api/characters', {
      method: 'POST',
      body: {
        ...form,
        systemId: selectedSystemId.value,
        dataJson: buildCharacterData()
      }
    })

    if (publish) {
      try {
        await $fetch(`/api/characters/${response.character.id}/publish`, { method: 'POST' })
        push('Personagem criado e enviado para analise da comunidade.', 'success')
      } catch (error) {
        apiError(error, 'Personagem criado, mas nao foi possivel enviar para a comunidade.')
      }
    } else {
      push('Personagem criado.', 'success')
    }

    await navigateTo('/app/characters')
  } catch (error) {
    apiError(error, 'Nao foi possivel criar personagem.')
  } finally {
    loading.value = false
    saveIntentOpen.value = false
  }
}

function buildCharacterData() {
  const next: Record<string, unknown> = { ...dataJson }
  const rpgClass = selectedClass.value

  next.nivel = Math.max(initialLevelForSchema(selectedSystem.value?.schemaJson), Math.min(Number(progression.level ?? 0), rpgClass?.maxLevel || 100))

  if (rpgClass) next.classe = rpgClass.key

  return applyClassProgression(selectedSystem.value?.schemaJson, next)
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
  progression.level = Math.max(initialLevelForSchema(selectedSystem.value?.schemaJson), Math.min(max, Number(progression.level ?? 0) + delta))
}

function hasPreviewAdjustment(field: DynamicField) {
  return field.type === 'NUMBER' && Number(previewDataJson.value[field.key] || 0) !== Number(dataJson[field.key] || 0)
}

function validateCharacterDraft() {
  const errors: string[] = []

  if (!form.name.trim()) errors.push('Informe o nome do personagem.')

  if (attributeFields.value.length && spentAttributes.value > effectiveAttributeBudget.value) {
    errors.push(`Distribua no maximo ${effectiveAttributeBudget.value} pontos de atributo.`)
  }

  if (systemClasses.value.length && !progression.classKey) {
    errors.push('Escolha uma classe.')
  }

  errors.push(...validateCharacterData(selectedSystem.value?.schemaJson, selectedSystem.value?.fields || [], buildCharacterData()))

  return errors
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function initializeTabData(tab: SheetTab) {
  if (['ITEMS', 'WEAPONS', 'TRAITS', 'POWERS', 'CONDITIONS', 'CUSTOM'].includes(tab.type)) {
    dataJson[tab.key] = []
    return
  }

  if (tab.type !== 'RULES' && tab.type !== 'CLASS_PROGRESS') {
    dataJson[tab.key] = {}
    tabRecordValues(tab)
  }
}

function tabRecordKey(record: SheetTabRecord, index: number) {
  return record.key || record.id || keyFromLabel(record.name || `registro_${index + 1}`)
}

function tabRecordValues(tab: SheetTab): Record<string, TabRecordValue> {
  if (!dataJson[tab.key] || typeof dataJson[tab.key] !== 'object' || Array.isArray(dataJson[tab.key])) {
    dataJson[tab.key] = {}
  }

  const values = dataJson[tab.key] as Record<string, TabRecordValue>

    ; (tab.records || []).forEach((record, index) => {
      const key = tabRecordKey(record, index)

      if (!values[key]) {
        values[key] = defaultRecordValue(tab, record)
      }
    })

  return values
}

function tabRecordValue(tab: SheetTab, record: SheetTabRecord, index: number) {
  return tabRecordValues(tab)[tabRecordKey(record, index)] || defaultRecordValue(tab, record)
}

function recordFormulaKey(record: SheetTabRecord) {
  return formulaKeyFromLabel(record.key || record.name)
}

function resourceDerivedValue(tab: SheetTab, record: SheetTabRecord, index: number) {
  const key = recordFormulaKey(record)
  const fallback = tabRecordValue(tab, record, index)
  return Number(previewDataJson.value[key] ?? dataJson[key] ?? fallback.max ?? fallback.current ?? 0)
}

function resourceSourceRows(record: SheetTabRecord) {
  const key = recordFormulaKey(record)
  const sources = previewDataJson.value.__sources as Record<string, Array<{ label: string, value: unknown, note?: string }>> | undefined
  if (sources?.[key]?.length) return sources[key]
  const base = Number(dataJson[key] ?? record.value ?? 0)
  return [{ label: 'Base do sistema', value: base }]
}

function sourceValueText(value: unknown) {
  if (typeof value === 'number') return value >= 0 ? `+${value}` : `${value}`
  return String(value ?? '')
}

function defaultRecordValue(tab: SheetTab, record: SheetTabRecord): TabRecordValue {
  if (tab.type === 'RESOURCES') {
    return {
      name: record.name,
      current: resolveNumericDefault(record.value, new Map(Object.entries(dataJson).map(([key, value]) => [formulaKeyFromLabel(key), String(Number(value || 0))]))),
      max: resolveNumericDefault(record.max, new Map(Object.entries(dataJson).map(([key, value]) => [formulaKeyFromLabel(key), String(Number(value || 0))]))),
      description: record.description || ''
    }
  }

  if (tab.type === 'TEXT_BLOCKS') {
    return {
      name: record.name,
      text: record.text || record.description || ''
    }
  }

  if (tab.type === 'ROLLS') {
    return {
      name: record.name,
      roll: record.roll || '',
      description: record.description || ''
    }
  }

  return {
    name: record.name,
    value: resolveNumericDefault(record.value, new Map(Object.entries(dataJson).map(([key, value]) => [formulaKeyFromLabel(key), String(Number(value || 0))]))),
    description: record.description || '',
    relatedAttribute: record.relatedAttribute || ''
  }
}

function setTabRecordValue(tab: SheetTab, record: SheetTabRecord, index: number, key: keyof TabRecordValue, value: unknown) {
  const values = tabRecordValues(tab)
  const recordKey = tabRecordKey(record, index)

  values[recordKey] ||= defaultRecordValue(tab, record)
  values[recordKey][key] = value as never

  if (record.key && ['value', 'current', 'max'].includes(String(key))) {
    dataJson[record.key] = value
  }
}

function skillState(tab: SheetTab, record: SheetTabRecord, index: number) {
  const values = tabRecordValues(tab)
  const key = tabRecordKey(record, index)

  values[key] ||= defaultRecordValue(tab, record)

  return values[key]
}

function selectedSkillCount(tab: SheetTab) {
  return Object.values(tabRecordValues(tab)).filter((item) => item.selected).length
}

function setSkillSelected(tab: SheetTab, record: SheetTabRecord, index: number, selected: boolean) {
  const state = skillState(tab, record, index)

  if (selected && !state.selected && rulesTotals.value.skillChoices > 0 && selectedSkillCount(tab) >= rulesTotals.value.skillChoices) {
    push(`Este nivel permite escolher ${rulesTotals.value.skillChoices} pericia(s).`, 'error')
    return
  }

  if (selected && rulesTotals.value.skillChoices <= 0) {
    push('Este nivel ainda nao libera escolhas de pericia.', 'error')
    return
  }

  state.selected = selected

  if (selected && record.useSkillLevels && !state.levelKey) {
    const first = record.skillLevels?.[0]

    state.levelKey = first?.key || ''
    state.value = first?.value ?? 0

    if (record.key) {
      dataJson[record.key] = state.value
    }
  }
}

function setSkillLevel(tab: SheetTab, record: SheetTabRecord, index: number, levelKey: string) {
  const state = skillState(tab, record, index)
  const level = record.skillLevels?.find((item) => item.key === levelKey)

  state.levelKey = levelKey
  state.value = level?.value ?? 0

  if (record.key) {
    dataJson[record.key] = state.value
  }
}

function tabItems(tab: SheetTab): TabItem[] {
  if (!Array.isArray(dataJson[tab.key])) {
    dataJson[tab.key] = []
  }

  return dataJson[tab.key] as TabItem[]
}

function defaultTabItem(tab: SheetTab, record: SheetTabRecord): TabItem {
  return {
    id: uid(tab.key),
    sourceRecordKey: record.key || keyFromLabel(record.name),
    name: record.name,
    description: record.description || record.text || '',
    damage: record.damage || '',
    weight: record.weight ?? null,
    roll: record.roll || '',
    cost: record.cost || '',
    range: record.range || '',
    ability: record.ability || '',
    bonus: record.bonus || '',
    effect: record.effect || '',
    quantity: record.quantity ?? null,
    fields: { ...(record.fields || {}) }
  }
}

function selectedRecordItem(tab: SheetTab, record: SheetTabRecord) {
  const key = formulaKeyFromLabel(record.key || record.name)

  return tabItems(tab).find((item) => formulaKeyFromLabel(String(item.sourceRecordKey || item.name || '')) === key)
}

function recordByItem(tab: SheetTab, item: TabItem) {
  const key = formulaKeyFromLabel(String(item.sourceRecordKey || item.name || ''))

  return (tab.records || []).find((record) => formulaKeyFromLabel(record.key || record.name) === key)
}

function selectionLimit(tab: SheetTab) {
  if (tab.type === 'TRAITS') return 1
  if (tab.type === 'POWERS') return rulesTotals.value.powerChoices

  return Number.POSITIVE_INFINITY
}

function toggleRecordItem(tab: SheetTab, record: SheetTabRecord) {
  const items = tabItems(tab)
  const selected = selectedRecordItem(tab, record)

  if (selected) {
    const index = items.indexOf(selected)

    if (index >= 0) {
      items.splice(index, 1)
    }

    return
  }

  const limit = selectionLimit(tab)

  if (items.length >= limit) {
    push(tab.type === 'TRAITS' ? 'Escolha apenas 1 traco/talento.' : `Este nivel permite escolher ${limit} registro(s) em ${tab.name}.`, 'error')
    return
  }

  const capacity = Number(rulesTotals.value.inventoryCapacity || 0)

  if (['ITEMS', 'WEAPONS'].includes(tab.type) && capacity > 0 && selectedWeight.value + Number(record.weight || 0) > capacity) {
    push(`Peso acima da capacidade: ${selectedWeight.value + Number(record.weight || 0)}/${capacity}.`, 'error')
    return
  }

  items.push(defaultTabItem(tab, record))
}

function isChoiceTab(tab: SheetTab) {
  return ['ITEMS', 'WEAPONS', 'TRAITS', 'POWERS', 'CONDITIONS'].includes(tab.type)
}

function renderMarkdown(value: unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="page-title">Novo personagem</h1>
      <p class="muted mt-1">Escolha um sistema do seu inventario e a ficha sera montada automaticamente.</p>
    </div>

    <form class="space-y-5" @submit.prevent="saveIntentOpen = true">
      <AppCard>
        <h2 class="mb-4 text-xl font-black text-white">Identidade</h2>

        <div class="grid gap-4">
          <label>
            <span class="label">Sistema *</span>
            <select v-model="selectedSystemId" class="select" :disabled="!systems?.systems.length">
              <option v-if="!systems?.systems.length" value="">Nenhum sistema no seu inventario</option>
              <option v-for="system in systems?.systems" :key="system.id" :value="system.id">
                {{ system.name }}
              </option>
            </select>
          </label>

          <label>
            <span class="label">Nome *</span>
            <input v-model="form.name" name="characterName" class="input" type="text">
          </label>

          <label>
            <span class="label">Avatar por URL</span>
            <input v-model="form.avatarUrl" name="avatarUrl" class="input" type="url" placeholder="https://...">
          </label>

          <label>
            <span class="label">Descricao curta</span>
            <textarea v-model="form.description" rows="3" class="input" placeholder="Opcional" />
          </label>
        </div>
      </AppCard>

      <AppCard v-if="formErrors.length" class="border-flare/40 bg-flare/10">
        <h2 class="text-lg font-black text-white">Antes de salvar:</h2>

        <ul class="mt-3 space-y-2 text-sm text-red-100">
          <li v-for="error in formErrors" :key="error">
            {{ error }}
          </li>
        </ul>
      </AppCard>

      <AppCard v-if="attributeFields.length">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-black text-white">Atributos</h2>
            <p class="muted mt-1">Distribua os pontos permitidos pelo sistema. Depois de criado, atributo nao fica livre
              para editar.</p>
          </div>

          <div class="rounded-lg border border-ember/25 bg-ember/10 px-3 py-2 text-sm font-black text-ember">
            {{ remainingAttributes }} restantes / {{ effectiveAttributeBudget }} total
          </div>
        </div>

        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="field in attributeFields" :key="field.key"
            class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <span class="label">{{ field.label }}</span>

            <div class="flex items-center gap-2">
              <button type="button"
                class="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white hover:border-ember/40"
                @click="setAttribute(field.key, -1)">
                -
              </button>

              <div class="input grid h-10 place-items-center px-0 text-center font-black">
                {{ dataJson[field.key] || 0 }}
              </div>

              <button type="button"
                class="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white hover:border-ember/40"
                @click="setAttribute(field.key, 1)">
                +
              </button>
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
            <span class="label">Classe *</span>
            <select v-model="progression.classKey" class="select" :disabled="!systemClasses.length">
              <option v-if="!systemClasses.length" value="">Nenhuma opcao disponivel</option>
              <option v-for="rpgClass in systemClasses" :key="rpgClass.key" :value="rpgClass.key">
                {{ rpgClass.name }}
              </option>
            </select>
          </label>

          <label>
            <span class="label">Nivel inicial</span>

            <div class="grid grid-cols-[42px_1fr_42px] gap-2">
              <button type="button" class="rounded-lg border border-white/10 text-white hover:border-ember/40"
                @click="changeLevel(-1)">
                -
              </button>

              <input v-model.number="progression.level" type="number" min="1" :max="selectedClass?.maxLevel || 100"
                class="input text-center font-black">

              <button type="button" class="rounded-lg border border-white/10 text-white hover:border-ember/40"
                @click="changeLevel(1)">
                +
              </button>
            </div>
          </label>
        </div>

        <div v-if="selectedClassChanges.length" class="mt-4 max-h-44 space-y-2 overflow-y-auto pr-2">
          <p v-for="(change, index) in selectedClassChanges" :key="index"
            class="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-sm text-mist">
            <template v-if="change.operation === 'NOTE'">
              Nivel {{ change.level }}: {{ change.note }}
            </template>

            <template v-else>
              Nivel {{ change.level }}: {{ change.operation === 'ADD' ? '+' : '=' }}{{ change.value }} em {{
                change.targetLabel || change.targetKey }}
            </template>
          </p>
        </div>
      </AppCard>

      <section v-if="selectedSystem" class="space-y-5">
        <AppCard>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="text-xl font-black text-white">Informações da ficha</h2>
              <p class="muted mt-1">Preencha os dados complementares do personagem.</p>
            </div>

            <div v-if="rulesTotals.inventoryCapacity > 0"
              class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-white">
              Peso {{ selectedWeight }}/{{ rulesTotals.inventoryCapacity }}
            </div>
          </div>

          <div v-if="rulesTotals.inventoryCapacity > 0" class="mt-4">
            <div class="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-mist">
              <span>Capacidade de inventario</span>
              <span>{{ selectedWeight }}/{{ rulesTotals.inventoryCapacity }}</span>
            </div>

            <div class="h-2 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
              <div class="h-full rounded-full bg-ember transition-all"
                :style="{ width: `${Math.min(100, (selectedWeight / Math.max(1, Number(rulesTotals.inventoryCapacity || 1))) * 100)}%` }" />
            </div>
          </div>

          <div v-if="editableFields.length" class="mt-4 grid gap-4 md:grid-cols-2">
            <div v-for="field in editableFields" :key="field.key"
              class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
              <DynamicFieldRenderer v-model="dataJson[field.key]" :field="field" />

              <p v-if="hasPreviewAdjustment(field)" class="mt-2 text-xs font-bold text-ember">
                Ajuste aplicado pela progressao: {{ previewDataJson[field.key] }}
              </p>
            </div>
          </div>

          <p v-if="!editableFields.length && !editableSheetTabs.length"
            class="mt-4 rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">
            Este sistema nao tem campos adicionais para preencher.
          </p>
        </AppCard>

        <AppCard v-for="tab in editableSheetTabs" :key="tab.id || tab.key">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-black text-white">{{ tab.name }}</h2>
              <p class="mt-1 text-sm text-mist">{{ tab.description || sheetTabTypeLabels[tab.type] }}</p>
            </div>

            <div v-if="tab.type === 'SKILLS'"
              class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-mist">
              {{ selectedSkillCount(tab) }}/{{ rulesTotals.skillChoices }} escolhidas
            </div>
          </div>

          <div v-if="tab.type === 'RULES'"
            class="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-mist">
            <div class="markdown-preview" v-html="renderMarkdown(tab.systemMarkdown || '')" />
          </div>

          <div v-else-if="tab.type === 'RESOURCES'" class="sheet-record-grid">
            <div v-for="(record, recordIndex) in tab.records || []" :key="record.id || recordIndex"
              class="resource-card rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="font-black text-white">{{ record.name }}</h3>
                  <p v-if="record.description" class="mt-1 line-clamp-2 text-sm leading-5 text-mist">{{ record.description }}</p>
                </div>
                <span class="rounded-md border border-ember/25 bg-ember/10 px-2 py-1 text-xs font-black text-ember">Calculado</span>
              </div>

              <div class="mt-4 rounded-lg border border-white/10 bg-panel/60 p-3">
                <span class="label">Total inicial</span>
                <p class="mt-1 text-2xl font-black text-white">{{ resourceDerivedValue(tab, record, recordIndex) }}</p>
                <p class="mt-1 text-xs text-mist">Definido pelo sistema, nivel, classe e atributos. Nao editavel na criacao.</p>
              </div>

              <details class="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <summary class="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-mist">Origem do valor</summary>
                <div class="mt-2 space-y-1 text-xs text-mist">
                  <div v-for="source in resourceSourceRows(record)" :key="`${source.label}:${source.value}`" class="flex items-center justify-between gap-3">
                    <span>{{ source.label }}</span>
                    <b class="text-white">{{ sourceValueText(source.value) }}</b>
                  </div>
                </div>
              </details>
            </div>

            <p v-if="!(tab.records || []).length"
              class="sheet-record-wide rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">
              Nenhum recurso definido neste sistema.
            </p>
          </div>

          <div v-else-if="tab.type === 'SKILLS'" class="sheet-record-grid">
            <div v-for="(record, recordIndex) in tab.records || []" :key="record.id || recordIndex"
              class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="font-black text-white">{{ record.name }}</h3>
                  <p v-if="record.description" class="mt-1 text-sm text-mist">{{ record.description }}</p>
                </div>

                <label class="flex items-center gap-2 text-xs font-bold text-mist">
                  <input :checked="Boolean(skillState(tab, record, recordIndex).selected)" type="checkbox"
                    class="accent-[var(--user-accent)]"
                    @change="setSkillSelected(tab, record, recordIndex, ($event.target as HTMLInputElement).checked)">
                  Escolher
                </label>
              </div>

              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <label>
                  <span class="label">Valor</span>

                  <select v-if="record.useSkillLevels" :value="skillState(tab, record, recordIndex).levelKey || ''"
                    class="select" :disabled="!skillState(tab, record, recordIndex).selected"
                    @change="setSkillLevel(tab, record, recordIndex, ($event.target as HTMLSelectElement).value)">
                    <option value="">Escolha o nivel</option>
                    <option v-for="level in record.skillLevels || []" :key="level.key" :value="level.key">
                      {{ level.name }} ({{ level.value >= 0 ? '+' : '' }}{{ level.value }})
                    </option>
                  </select>

                  <input v-else :value="tabRecordValue(tab, record, recordIndex).value as string | number" type="number"
                    class="input" :readonly="!skillState(tab, record, recordIndex).selected"
                    @input="setTabRecordValue(tab, record, recordIndex, 'value', Number(($event.target as HTMLInputElement).value))">
                </label>

                <label>
                  <span class="label">Atributo relacionado</span>
                  <input :value="String(tabRecordValue(tab, record, recordIndex).relatedAttribute || '')" class="input"
                    @input="setTabRecordValue(tab, record, recordIndex, 'relatedAttribute', ($event.target as HTMLInputElement).value)">
                </label>
              </div>
            </div>

            <p v-if="!(tab.records || []).length"
              class="sheet-record-wide rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">
              Nenhuma pericia definida neste sistema.
            </p>
          </div>

          <div v-else-if="isChoiceTab(tab) && (tab.records || []).length"
            class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <button v-for="record in tab.records || []" :key="record.key || record.id || record.name" type="button"
              class="min-h-32 rounded-lg border p-4 text-left transition"
              :class="selectedRecordItem(tab, record) ? 'border-ember/50 bg-ember/10 shadow-[0_0_0_1px_rgba(255,138,19,0.12)]' : 'border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]'"
              @click="toggleRecordItem(tab, record)">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="truncate text-lg font-black text-white">{{ record.name }}</h3>
                  <p v-if="record.description || record.text" class="mt-1 line-clamp-2 text-sm leading-6 text-mist">
                    {{ record.description || record.text }}
                  </p>
                </div>

                <span class="shrink-0 rounded-md border px-2 py-1 text-xs font-bold"
                  :class="selectedRecordItem(tab, record) ? 'border-ember/35 bg-ember/15 text-ember' : 'border-white/10 text-mist'">
                  {{ selectedRecordItem(tab, record) ? 'Escolhido' : 'Escolher' }}
                </span>
              </div>

              <div class="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                <span v-if="record.damage"
                  class="rounded-md border border-white/10 bg-panel/60 px-2 py-1 text-mist">Dano {{
                  record.damage }}</span>
                <span v-if="record.roll"
                  class="rounded-md border border-white/10 bg-panel/60 px-2 py-1 text-mist">Rolagem {{
                  record.roll }}</span>
                <span v-if="record.bonus" class="rounded-md border border-white/10 bg-panel/60 px-2 py-1 text-mist">{{
                  record.bonus }}</span>
                <span v-if="record.weight"
                  class="rounded-md border border-white/10 bg-panel/60 px-2 py-1 text-mist">Peso {{
                  record.weight }}</span>
              </div>
            </button>
          </div>

          <div v-else-if="['ROLLS', 'TEXT_BLOCKS'].includes(tab.type)" class="grid gap-3">
            <div v-for="(record, recordIndex) in tab.records || []" :key="record.id || recordIndex"
              class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <h3 class="font-black text-white">{{ record.name }}</h3>

              <label v-if="tab.type === 'ROLLS'" class="mt-3 block">
                <span class="label">Formula</span>
                <input :value="String(tabRecordValue(tab, record, recordIndex).roll || '')" class="input"
                  placeholder="1d20 + POT"
                  @input="setTabRecordValue(tab, record, recordIndex, 'roll', ($event.target as HTMLInputElement).value)">
              </label>

              <label v-else class="mt-3 block">
                <span class="label">Texto</span>
                <textarea :value="String(tabRecordValue(tab, record, recordIndex).text || '')" rows="4" class="input"
                  @input="setTabRecordValue(tab, record, recordIndex, 'text', ($event.target as HTMLTextAreaElement).value)" />
              </label>
            </div>
          </div>

          <div v-else class="rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">
            {{ tab.name }} nao tem registros configurados para preencher agora.
          </div>
        </AppCard>
      </section>

      <AppButton type="submit" :loading="loading">
        Salvar personagem
      </AppButton>
    </form>

    <SavePublishModal :open="saveIntentOpen" title="Salvar personagem"
      message="Salvar cria o personagem no seu inventario. Salvar e postar cria um snapshot para analise da comunidade."
      :loading="loading" @close="saveIntentOpen = false" @save="submit(false)" @publish="submit(true)" />
  </div>
</template>

<style scoped>
.sheet-record-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
  gap: 0.85rem;
}

.sheet-record-wide {
  grid-column: 1 / -1;
}

.resource-card {
  min-height: 13.5rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.line-clamp-2 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.markdown-preview :deep(code) {
  border: 1px solid rgb(255 255 255 / 0.1);
  border-radius: 0.35rem;
  background: rgb(255 255 255 / 0.06);
  padding: 0.05rem 0.3rem;
  color: var(--user-accent);
}
</style>
