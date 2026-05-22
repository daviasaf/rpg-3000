<script setup lang="ts">
import { Copy, FileText, GripVertical, Plus, SlidersHorizontal, Table2, Trash2, X } from 'lucide-vue-next'
import type { DynamicField, RecordLevelRule, RuleEffect, RuleTable, SheetFieldType, SheetTab, SheetTabField, SheetTabRecord, SheetTabType, SystemClass, SystemClassLevel, SystemClassLevelChange, SystemLevelRule, SystemSchema } from '../../shared/types/system'
import { createEmptyRuleTable, createRuleEffect, createSheetTab, fieldsFromSheetTabs, formulaKeyFromLabel, keyFromLabel, normalizeSheetTabs, sheetFieldTypeLabels, sheetTabTypeLabels, uid } from '~~/shared/utils/sheetTabs'
import { formulaVariableList } from '~~/shared/utils/characterRules'

const fields = defineModel<DynamicField[]>('fields', { required: true })
const schema = defineModel<SystemSchema>('schema', { required: true })

const tabs = computed({
  get: () => schema.value.sheetTabs || [],
  set: (next: SheetTab[]) => {
    schema.value.sheetTabs = next.map((tab, index) => ({ ...tab, order: index }))
    fields.value = fieldsFromSheetTabs(schema.value.sheetTabs, fields.value)
  }
})

const tabTypes: SheetTabType[] = ['ATTRIBUTES', 'RESOURCES', 'SKILLS', 'CLASS_PROGRESS', 'ITEMS', 'WEAPONS', 'TRAITS', 'POWERS', 'TEXT_BLOCKS', 'CONDITIONS', 'RULES', 'ROLLS', 'CUSTOM']
const fieldTypes: SheetFieldType[] = ['SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'CHECKBOX', 'SELECT', 'LIST', 'DAMAGE', 'ROLL', 'COST', 'RANGE', 'IMAGE', 'TAGS']
const activeTabId = ref('')
const createOpen = ref(false)
const pendingDeleteTab = ref<SheetTab | null>(null)
const pendingDeleteRecord = ref<{ tab: SheetTab; index: number; name: string } | null>(null)
const pendingDeleteLevelIndex = ref<number | null>(null)
const advancedTabId = ref('')
const advancedRecordId = ref('')
const selectedType = ref<SheetTabType>('ATTRIBUTES')
const newTabName = ref('')

if (!schema.value.leveling) {
  schema.value.leveling = {
    levelOneAttributePoints: 6,
    initialLevel: 0,
    attributesPerLevel: 1,
    levelOneAttributeLimit: 5,
    attributeLimitIncreasePerLevel: 1,
    maxAttributeLimit: 20
  }
}
schema.value.levelProgression ||= [{ id: uid('level_rule'), level: 0, attributeBudget: 6, attributePoints: 5, skillChoices: 0, powerChoices: 0, traitChoices: 0, itemChoices: 0, weaponChoices: 0, inventoryCapacity: 0, effects: [], tables: [], notes: 'Base inicial do personagem.' }]
schema.value.levelProgression = schema.value.levelProgression.map((rule, index) => ({
  ...rule,
  id: rule.id || uid('level_rule'),
  level: Number(rule.level ?? index),
  attributeBudget: Number(rule.attributeBudget ?? rule.attributePoints ?? (index === 0 ? 6 : index + 6)),
  attributePoints: Number(rule.attributePoints ?? (index === 0 ? 5 : index + 5)),
  effects: rule.effects || [],
  tables: rule.tables || []
}))

schema.value.sheetTabs = normalizeSheetTabs(schema.value)
if (!schema.value.sheetTabs.length) schema.value.sheetTabs = []
fields.value = fieldsFromSheetTabs(schema.value.sheetTabs, fields.value)
activeTabId.value = 'level_progression'

const isProgressionActive = computed(() => activeTabId.value === 'level_progression')
const activeTab = computed(() => isProgressionActive.value ? undefined : tabs.value.find((tab) => tab.id === activeTabId.value) || tabs.value[0])
const previewTabs = computed(() => tabs.value)
const classes = computed(() => schema.value.classes || [])
const formulaVariables = computed(() => formulaVariableList(schema.value, fields.value))
const progressCapabilities = computed(() => {
  const hasTab = (types: SheetTabType[]) => tabs.value.some((tab) => types.includes(tab.type) && (tab.records?.length || tab.type === 'CLASS_PROGRESS'))
  return {
    attributes: hasTab(['ATTRIBUTES']) || fields.value.some((field) => field.category === 'ATTRIBUTE'),
    skills: hasTab(['SKILLS']) || fields.value.some((field) => field.category === 'SKILL'),
    powers: hasTab(['POWERS']),
    equipment: hasTab(['ITEMS', 'WEAPONS']),
    resources: hasTab(['RESOURCES']) || fields.value.some((field) => field.category === 'RESOURCE' || field.category === 'STATUS_BAR'),
    classes: hasTab(['CLASS_PROGRESS']) || Boolean(schema.value.classes?.length)
  }
})

type EffectTarget = { key: string; label: string; type: RuleEffect['type'] }
const effectTargets = computed<EffectTarget[]>(() => {
  const targets: EffectTarget[] = [{ key: 'DANO_RECEBIDO', label: 'Dano recebido', type: 'DAMAGE_RECEIVED' }]
  if (progressCapabilities.value.attributes) {
    targets.push({ key: 'ATTRIBUTE_POINT', label: 'Ponto livre de atributo', type: 'ATTRIBUTE_POINT' })
  }
  for (const tab of tabs.value) {
    for (const record of tab.records || []) {
      const key = formulaKeyFromLabel(record.key || record.name)
      const type = effectTypeForTab(tab.type)
      if (type) targets.push({ key, label: `${record.name} (${tab.name})`, type })
    }
  }
  for (const field of fields.value) {
    targets.push({ key: formulaKeyFromLabel(field.key), label: field.label, type: field.category === 'ATTRIBUTE' ? 'ATTRIBUTE' : field.category === 'SKILL' ? 'SKILL' : field.category === 'RESOURCE' || field.category === 'STATUS_BAR' ? 'RESOURCE' : 'CUSTOM' })
  }
  const seen = new Set<string>()
  return targets.filter((target) => {
    const fingerprint = `${target.type}:${target.key}`
    if (seen.has(fingerprint)) return false
    seen.add(fingerprint)
    return true
  })
})

function effectTypeForTab(type: SheetTabType): RuleEffect['type'] | null {
  if (type === 'ATTRIBUTES') return 'ATTRIBUTE'
  if (type === 'RESOURCES') return 'RESOURCE'
  if (type === 'SKILLS') return 'SKILL'
  if (type === 'ITEMS') return 'ITEM'
  if (type === 'WEAPONS') return 'WEAPON'
  if (type === 'TRAITS') return 'TRAIT'
  if (type === 'POWERS') return 'POWER'
  if (type === 'CONDITIONS') return 'CONDITION'
  if (type === 'ROLLS') return 'ROLL'
  if (type === 'CUSTOM') return 'CUSTOM'
  return null
}

const effectOperations: Array<{ value: RuleEffect['operation']; label: string }> = [
  { value: 'ADD', label: 'Somar' },
  { value: 'SUBTRACT', label: 'Subtrair' },
  { value: 'SET', label: 'Definir' },
  { value: 'MULTIPLY', label: 'Multiplicar' },
  { value: 'HALVE', label: 'Metade' },
  { value: 'CHOICE', label: 'Escolha do jogador' },
  { value: 'NOTE', label: 'Texto' }
]
const classTargets = computed(() => {
  const fromEffects = effectTargets.value
    .filter((target) => !['ITEM', 'WEAPON', 'TRAIT', 'POWER', 'CONDITION'].includes(target.type))
    .map((target) => ({ key: target.key, label: target.label, category: target.type }))
  const seen = new Set<string>()
  return fromEffects.filter((field) => {
    if (seen.has(field.key)) return false
    seen.add(field.key)
    return true
  })
})

watch(tabs, () => {
  fields.value = fieldsFromSheetTabs(tabs.value, fields.value)
}, { deep: true })

function openCreate(type: SheetTabType = 'ATTRIBUTES') {
  selectedType.value = type
  newTabName.value = sheetTabTypeLabels[type]
  createOpen.value = true
}

function createTab() {
  const next = createSheetTab(selectedType.value, tabs.value.length)
  next.name = newTabName.value.trim() || sheetTabTypeLabels[selectedType.value]
  next.key = uniqueTabKey(keyFromLabel(next.name))
  tabs.value = [...tabs.value, next]
  activeTabId.value = next.id || ''
  createOpen.value = false
}

function uniqueTabKey(base: string, ignoreId = '') {
  const clean = keyFromLabel(base || 'aba')
  const used = new Set(tabs.value.filter((tab) => tab.id !== ignoreId).map((tab) => tab.key))
  if (!used.has(clean)) return clean
  let index = 2
  while (used.has(`${clean}_${index}`)) index += 1
  return `${clean}_${index}`
}

function syncTabKey(tab: SheetTab) {
  tab.key = uniqueTabKey(tab.name, tab.id)
}

function actionItems(tab: SheetTab) {
  const index = tabs.value.findIndex((item) => item.id === tab.id)
  return [
    { key: 'advanced', label: advancedTabId.value === tab.id ? 'Ocultar avancado' : 'Configuracoes avancadas', icon: SlidersHorizontal },
    { key: 'table', label: 'Adicionar tabela', icon: Table2 },
    { key: 'up', label: 'Mover para cima', icon: GripVertical, disabled: index <= 0 },
    { key: 'down', label: 'Mover para baixo', icon: GripVertical, disabled: index === tabs.value.length - 1 },
    { key: 'duplicate', label: 'Duplicar', icon: Copy },
    { key: 'delete', label: 'Apagar aba', icon: Trash2, danger: true }
  ]
}

function handleAction(tab: SheetTab, action: string) {
  const index = tabs.value.findIndex((item) => item.id === tab.id)
  if (index < 0) return
  if (action === 'advanced') {
    advancedTabId.value = advancedTabId.value === tab.id ? '' : tab.id || ''
  }
  if (action === 'up' || action === 'down') {
    const next = [...tabs.value]
    const target = action === 'up' ? index - 1 : index + 1
    const current = next[index]
    const targetTab = next[target]
    if (!current || !targetTab) return
    next[index] = targetTab
    next[target] = current
    tabs.value = next
  }
  if (action === 'table') {
    tab.tables ||= []
    tab.tables.push(createEmptyRuleTable())
    advancedTabId.value = tab.id || ''
  }
  if (action === 'duplicate') {
    const clone = structuredClone(tab)
    clone.id = uid('sheet_tab')
    clone.name = `${tab.name} copia`
    clone.key = uniqueTabKey(clone.name)
    clone.order = tabs.value.length
    clone.fields = clone.fields?.map((field) => ({ ...field, id: uid('sheet_field') }))
    clone.records = clone.records?.map((record) => ({ ...record, id: uid('sheet_record') }))
    tabs.value = [...tabs.value, clone]
    activeTabId.value = clone.id || ''
  }
  if (action === 'delete') {
    pendingDeleteTab.value = tab
  }
}

function recordActionItems(record: SheetTabRecord) {
  return [
    { key: 'advanced', label: advancedRecordId.value === record.id ? 'Ocultar avancado' : 'Configuracoes avancadas', icon: SlidersHorizontal },
    { key: 'effect', label: 'Adicionar modificacao', icon: SlidersHorizontal },
    { key: 'level', label: 'Adicionar nivel', icon: Plus },
    { key: 'table', label: 'Adicionar tabela', icon: Table2 },
    { key: 'duplicate', label: 'Duplicar', icon: Copy },
    { key: 'delete', label: 'Apagar registro', icon: Trash2, danger: true }
  ]
}

function handleRecordAction(tab: SheetTab, record: SheetTabRecord, index: number, action: string) {
  if (action === 'advanced') {
    advancedRecordId.value = advancedRecordId.value === record.id ? '' : record.id || ''
  }
  if (action === 'effect') {
    addEffect(record)
    advancedRecordId.value = record.id || ''
  }
  if (action === 'level') {
    addRecordLevel(record)
    advancedRecordId.value = record.id || ''
  }
  if (action === 'table') {
    record.tables ||= []
    record.tables.push(createEmptyRuleTable())
    advancedRecordId.value = record.id || ''
  }
  if (action === 'duplicate') {
    tab.records ||= []
    const clone = structuredClone(record)
    clone.id = uid('sheet_record')
    clone.name = `${record.name} copia`
    clone.key = formulaKeyFromLabel(clone.name)
    tab.records.splice(index + 1, 0, clone)
    advancedRecordId.value = clone.id || ''
  }
  if (action === 'delete') {
    pendingDeleteRecord.value = { tab, index, name: record.name }
  }
}

function confirmDeleteRecord() {
  const pending = pendingDeleteRecord.value
  if (!pending) return
  pending.tab.records?.splice(pending.index, 1)
  pendingDeleteRecord.value = null
}

function confirmDeleteTab() {
  const tab = pendingDeleteTab.value
  if (!tab) return
  const index = tabs.value.findIndex((item) => item.id === tab.id)
  const next = tabs.value.filter((item) => item.id !== tab.id)
  tabs.value = next
  activeTabId.value = next[Math.max(0, index - 1)]?.id || ''
  pendingDeleteTab.value = null
}

function addRecord(tab: SheetTab) {
  tab.records ||= []
  const nextIndex = tab.records.length + 1
  tab.records.push({
    id: uid('sheet_record'),
    key: formulaKeyFromLabel(recordName(tab, nextIndex)),
    name: recordName(tab, nextIndex),
    description: '',
    text: '',
    value: ['ATTRIBUTES', 'RESOURCES', 'SKILLS'].includes(tab.type) ? 0 : '',
    min: null,
    max: null,
    damage: '',
    weight: null,
    roll: '',
    cost: '',
    range: '',
    ability: '',
    bonus: '',
    effect: '',
    quantity: tab.type === 'ITEMS' ? 1 : null,
    fields: {},
    useSkillLevels: false,
    skillLevels: []
  })
}

function recordName(tab: SheetTab, index: number) {
  const labels: Partial<Record<SheetTabType, string>> = {
    ATTRIBUTES: 'Atributo',
    RESOURCES: 'Recurso',
    SKILLS: 'Pericia',
    ITEMS: 'Item',
    WEAPONS: 'Arma',
    TRAITS: 'Traco',
    POWERS: 'Poder',
    TEXT_BLOCKS: 'Bloco',
    CONDITIONS: 'Condicao',
    ROLLS: 'Rolagem',
    CUSTOM: tab.name || 'Registro'
  }
  return `${labels[tab.type] || 'Registro'} ${index}`
}

function removeRecord(tab: SheetTab, index: number) {
  tab.records?.splice(index, 1)
}

function syncRecordKey(record: SheetTabRecord) {
  record.key = formulaKeyFromLabel(record.key || record.name)
}

function copyKey(key?: string) {
  if (!key || !import.meta.client || !navigator.clipboard) return
  void navigator.clipboard.writeText(key)
}

function addSkillLevel(record: SheetTabRecord) {
  record.skillLevels ||= []
  const nextIndex = record.skillLevels.length + 1
  const name = `Nivel ${nextIndex}`
  record.skillLevels.push({
    id: uid('skill_level'),
    name,
    key: formulaKeyFromLabel(name),
    value: 0
  })
}

function removeSkillLevel(record: SheetTabRecord, index: number) {
  record.skillLevels?.splice(index, 1)
}

function syncSkillLevelKey(level: NonNullable<SheetTabRecord['skillLevels']>[number]) {
  level.key = formulaKeyFromLabel(level.key || level.name)
}

function addLevelRule() {
  schema.value.levelProgression ||= []
  const nextLevel = Math.max(0, ...schema.value.levelProgression.map((item) => Number(item.level ?? 0))) + 1
  const previous = schema.value.levelProgression[schema.value.levelProgression.length - 1] || schema.value.levelProgression[0]
  schema.value.levelProgression.push({
    id: uid('level_rule'),
    level: nextLevel,
    attributeBudget: Number(previous?.attributeBudget ?? 6),
    attributePoints: Number(previous?.attributePoints ?? 5),
    skillChoices: Number(previous?.skillChoices ?? 0),
    powerChoices: Number(previous?.powerChoices ?? 0),
    traitChoices: 0,
    itemChoices: 0,
    weaponChoices: 0,
    inventoryCapacity: Number(previous?.inventoryCapacity ?? 0),
    effects: [],
    tables: [],
    notes: ''
  })
}

function removeLevelRule(index: number) {
  schema.value.levelProgression?.splice(index, 1)
}

function levelRuleActionItems() {
  return [{ key: 'delete', label: 'Apagar nivel', icon: Trash2, danger: true }]
}

function handleLevelRuleAction(index: number, action: string) {
  if (action === 'delete') pendingDeleteLevelIndex.value = index
}

function confirmDeleteLevelRule() {
  if (pendingDeleteLevelIndex.value === null) return
  removeLevelRule(pendingDeleteLevelIndex.value)
  pendingDeleteLevelIndex.value = null
}


function addCustomField(tab: SheetTab) {
  tab.fields ||= []
  const nextIndex = tab.fields.length + 1
  tab.fields.push({
    id: uid('sheet_field'),
    label: `Campo ${nextIndex}`,
    key: `campo_${nextIndex}`,
    type: 'SHORT_TEXT',
    required: false,
    defaultValue: '',
    options: [],
    order: nextIndex
  })
}

function removeCustomField(tab: SheetTab, index: number) {
  tab.fields?.splice(index, 1)
}

function syncFieldKey(tab: SheetTabField) {
  tab.key = keyFromLabel(tab.label)
}

function addClass() {
  schema.value.classes ||= []
  const nextIndex = schema.value.classes.length + 1
  schema.value.classes.push({
    id: uid('class'),
    key: `classe_${nextIndex}`,
    name: `Classe ${nextIndex}`,
    description: '',
    maxLevel: 5,
    levels: createLevels(5)
  })
}

function removeClass(index: number) {
  schema.value.classes?.splice(index, 1)
}

function createLevels(maxLevel: number, previous: SystemClassLevel[] = []) {
  return Array.from({ length: Math.max(1, Number(maxLevel || 1)) + 1 }, (_, index) => {
    const level = index
    return previous.find((item) => item.level === level) || { level, description: level === 0 ? 'Base inicial da classe.' : '', changes: [] }
  })
}

function resizeClassLevels(rpgClass: SystemClass) {
  rpgClass.maxLevel = Math.max(1, Math.min(100, Number(rpgClass.maxLevel || 1)))
  rpgClass.levels = createLevels(rpgClass.maxLevel, rpgClass.levels)
}

function addLevelChange(level: SystemClassLevel) {
  const target = classTargets.value.find((item) => item.key !== 'ATTRIBUTE_POINT') || classTargets.value[0]
  if (!target) return
  level.changes.push({ targetKey: target.key, targetLabel: target.label, operation: 'ADD', value: 1, note: '', type: target.category as RuleEffect['type'] })
}

function addAttributePoint(level: SystemClassLevel) {
  if (!progressCapabilities.value.attributes) return
  level.changes.push({ targetKey: 'ATTRIBUTE_POINT', targetLabel: 'Ponto livre de atributo', operation: 'ADD', value: 1, note: 'Ponto livre para distribuir em qualquer atributo permitido.', type: 'ATTRIBUTE_POINT', choiceCount: 1 })
}

function addLevelText(level: SystemClassLevel) {
  level.changes.push({ operation: 'NOTE', note: 'Novo texto de classe para mostrar na ficha.' })
}

function levelActionItems() {
  return [
    { key: 'text', label: 'Texto', icon: FileText },
    ...(progressCapabilities.value.attributes ? [{ key: 'attributePoint', label: 'Ponto livre de atributo', icon: Plus }] : []),
    { key: 'change', label: 'Alteracao', icon: SlidersHorizontal, disabled: classTargets.value.length === 0 }
  ]
}

function handleLevelAction(level: SystemClassLevel, action: string) {
  if (action === 'text') addLevelText(level)
  if (action === 'attributePoint') addAttributePoint(level)
  if (action === 'change') addLevelChange(level)
}

function removeLevelChange(level: SystemClassLevel, index: number) {
  level.changes.splice(index, 1)
}

function syncTargetLabel(change: SystemClassLevelChange) {
  if (!change.targetKey) return
  const target = classTargets.value.find((field) => field.key === change.targetKey)
  change.targetLabel = target?.label || change.targetKey
  change.type = target?.category as RuleEffect['type'] || 'CUSTOM'
  if (change.type === 'ATTRIBUTE_POINT') {
    change.targetLabel = 'Ponto livre de atributo'
    change.operation = 'ADD'
    change.value = Number(change.value || change.choiceCount || 1)
    change.choiceCount = Number(change.choiceCount || change.value || 1)
  }
}

function addEffect(target: SheetTabRecord | SystemLevelRule | RecordLevelRule) {
  const option = effectTargets.value[0]
  target.effects ||= []
  target.effects.push(createRuleEffect(option?.type || 'TEXT', option ? { key: option.key, label: option.label } : undefined))
}

function addRecordLevel(record: SheetTabRecord) {
  record.levels ||= []
  const nextLevel = Math.max(0, ...record.levels.map((item) => Number(item.level ?? 0))) + 1
  record.levels.push({ id: uid('record_level'), level: nextLevel, name: `Nivel ${nextLevel}`, description: '', effects: [], tables: [] })
}

function removeEffect(list: RuleEffect[] | undefined, index: number) {
  list?.splice(index, 1)
}

function syncEffectTarget(effect: RuleEffect) {
  const target = effectTargets.value.find((item) => item.key === effect.targetKey)
  if (!target) return
  effect.type = target.type
  effect.targetLabel = target.label
  if (target.type === 'ATTRIBUTE_POINT') {
    effect.operation = 'CHOICE'
    effect.choiceCount = Number(effect.choiceCount || effect.value || 1)
  }
}

function addTableRow(table: RuleTable) {
  const width = Math.max(1, table.headers?.length || table.rows?.[0]?.length || 2)
  table.rows.push(Array.from({ length: width }, () => ''))
}

function removeTableRow(table: RuleTable, index: number) {
  table.rows.splice(index, 1)
}

function addTableColumn(table: RuleTable) {
  table.headers ||= []
  table.headers.push(`Coluna ${table.headers.length + 1}`)
  for (const row of table.rows) row.push('')
}

function removeTableColumn(table: RuleTable, index: number) {
  table.headers?.splice(index, 1)
  for (const row of table.rows) row.splice(index, 1)
}

function removeTable(tables: RuleTable[] | undefined, index: number) {
  tables?.splice(index, 1)
}

function operationLabel(operation: RuleEffect['operation'] | SystemClassLevelChange['operation']) {
  const labels: Record<string, string> = {
    ADD: 'soma',
    SUBTRACT: 'subtrai',
    SET: 'define',
    MULTIPLY: 'multiplica',
    HALVE: 'reduz pela metade',
    CHOICE: 'permite escolher',
    NOTE: 'texto'
  }
  return labels[operation] || String(operation || '').toLowerCase()
}

function effectSummary(effect: RuleEffect) {
  if (effect.type === 'ATTRIBUTE_POINT') return `${effect.choiceCount || effect.value || 1} ponto(s) livre(s) de atributo para distribuir`
  if (effect.operation === 'NOTE') return effect.note || 'Texto informativo'
  return `${effect.targetLabel || effect.targetKey || 'Alvo'}: ${operationLabel(effect.operation)} ${effect.value ?? ''}${effect.perPoint ? ' multiplicado pelo valor do alvo' : ''}`
}

function fieldValue(record: SheetTabRecord, key: string) {
  record.fields ||= {}
  return record.fields[key]
}

function setFieldValue(record: SheetTabRecord, key: string, value: unknown) {
  record.fields ||= {}
  record.fields[key] = value
}
</script>

<template>
  <div class="space-y-5">
    <AppCard>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-xl font-black text-white">Construtor da ficha</h2>
          <p class="muted mt-1">Crie somente as abas que este sistema precisa. O personagem depois apenas preenche os valores.</p>
        </div>
        <AppButton type="button" @click="openCreate()"><Plus class="h-4 w-4" />Criar aba</AppButton>
      </div>

    </AppCard>

    <div class="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <AppCard>
        <div class="flex items-center justify-between gap-3">
          <h3 class="font-black text-white">Abas da ficha</h3>
          <span class="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-mist">{{ tabs.length + 1 }}</span>
        </div>

        <div class="mt-4 space-y-2">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition"
            :class="isProgressionActive ? 'border-ember/45 bg-ember/10' : 'border-white/10 bg-white/[0.04] hover:border-white/20'"
            @click="activeTabId = 'level_progression'"
          >
            <span class="min-w-0">
              <span class="block truncate text-sm font-black text-white">Progressao de nivel</span>
              <span class="block truncate text-xs text-mist">Configuracao central</span>
            </span>
          </button>
          <button
            v-for="tab in tabs"
            :key="tab.id || tab.key"
            type="button"
            class="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition"
            :class="activeTab?.id === tab.id ? 'border-ember/45 bg-ember/10' : 'border-white/10 bg-white/[0.04] hover:border-white/20'"
            @click="activeTabId = tab.id || ''"
          >
            <span class="min-w-0">
              <span class="block truncate text-sm font-black text-white">{{ tab.name }}</span>
              <span class="block truncate text-xs text-mist">{{ sheetTabTypeLabels[tab.type] }}</span>
            </span>
          </button>
        </div>
      </AppCard>

      <div class="space-y-5">
        <AppCard v-if="isProgressionActive">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.12em] text-ember">Configuracao central</p>
              <h3 class="mt-1 text-lg font-black text-white">Progressao de nivel</h3>
              <p class="muted mt-1">Mostra apenas regras relacionadas ao que ja existe neste sistema.</p>
            </div>
            <AppButton type="button" variant="ghost" @click="addLevelRule"><Plus class="h-4 w-4" />Nivel</AppButton>
          </div>

          <div class="mt-4 space-y-3">
            <div v-for="(levelRule, levelIndex) in schema.levelProgression || []" :key="levelRule.id || levelIndex" class="rounded-lg border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div class="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <span class="text-[10px] font-black uppercase tracking-[0.14em] text-ember">Regra global</span>
                  <h4 class="mt-1 font-black text-white">Nivel {{ levelRule.level ?? levelIndex }}</h4>
                  <p class="mt-1 text-xs leading-5 text-mist">Pontos, limites e escolhas que todos os personagens seguem neste nivel.</p>
                </div>
                <AppActionMenu :items="levelRuleActionItems()" title="Acoes do nivel" @select="handleLevelRuleAction(levelIndex, $event)" />
              </div>
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label><span class="label">Nivel</span><input v-model.number="levelRule.level" type="number" min="0" class="input"></label>
                <label v-if="progressCapabilities.attributes" class="xl:col-span-2"><span class="label">Pontos para usar no nivel</span><input v-model.number="levelRule.attributeBudget" type="number" min="0" class="input"></label>
                <label v-if="progressCapabilities.attributes" class="xl:col-span-2"><span class="label">Pontos maximos por atributo</span><input v-model.number="levelRule.attributePoints" type="number" min="0" class="input"></label>
                <label v-if="progressCapabilities.skills"><span class="label">Pericias por nivel</span><input v-model.number="levelRule.skillChoices" type="number" min="0" class="input"></label>
                <label v-if="progressCapabilities.powers"><span class="label">Poderes por nivel</span><input v-model.number="levelRule.powerChoices" type="number" min="0" class="input"></label>
                <label v-if="progressCapabilities.equipment"><span class="label">Capacidade de peso</span><input v-model.number="levelRule.inventoryCapacity" type="number" min="0" class="input"></label>
                <label class="md:col-span-2 xl:col-span-5"><span class="label">Regra textual</span><textarea v-model="levelRule.notes" rows="2" class="input" /></label>
                <div class="md:col-span-2 xl:col-span-5 space-y-2 rounded-lg border border-white/10 bg-panel/60 p-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p class="text-sm font-black text-white">Efeitos deste nivel</p>
                      <p class="text-xs text-mist">Use o + para adicionar ganhos vindos das abas existentes do sistema.</p>
                    </div>
                    <AppButton type="button" variant="ghost" @click="addEffect(levelRule)"><Plus class="h-4 w-4" />Efeito</AppButton>
                  </div>
                  <div v-for="(effect, effectIndex) in levelRule.effects || []" :key="effect.id || effectIndex" class="grid gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-2 lg:grid-cols-[1.2fr_130px_120px_1fr_auto]">
                    <label><span class="label">Alvo</span><select v-model="effect.targetKey" class="select" @change="syncEffectTarget(effect)"><option v-for="target in effectTargets" :key="`${target.type}:${target.key}`" :value="target.key">{{ target.label }}</option></select></label>
                    <label><span class="label">Regra</span><select v-model="effect.operation" class="select"><option v-for="operation in effectOperations" :key="operation.value" :value="operation.value">{{ operation.label }}</option></select></label>
                    <label><span class="label">Valor</span><FormulaTextInput v-model="effect.value" :variables="formulaVariables" placeholder="5 + FORCA" /></label>
                    <label><span class="label">Nota</span><input v-model="effect.note" class="input" placeholder="Origem mostrada na ficha"></label>
                    <AppActionMenu class="self-end" :items="[{ key: 'delete', label: 'Apagar efeito', icon: Trash2, danger: true }]" title="Acoes do efeito" @select="$event === 'delete' && removeEffect(levelRule.effects, effectIndex)" />
                    <label class="flex items-center gap-2 text-xs font-bold text-mist lg:col-span-5"><input v-model="effect.perPoint" type="checkbox" class="accent-[var(--user-accent)]">Multiplicar pelo valor atual do alvo. Use quando cada ponto do alvo gerar este efeito.</label>
                  </div>
                </div>
              </div>
            </div>
            <EmptyState
              v-if="!(schema.levelProgression || []).length"
              :icon="FileText"
              title="Nenhum nivel configurado"
              description="Crie ao menos o nivel inicial para limitar a ficha do personagem."
            >
              <AppButton type="button" @click="addLevelRule"><Plus class="h-4 w-4" />Criar nivel</AppButton>
            </EmptyState>
          </div>
        </AppCard>

        <AppCard v-if="activeTab">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.12em] text-ember">{{ sheetTabTypeLabels[activeTab.type] }}</p>
              <h2 class="mt-1 text-xl font-black text-white">{{ activeTab.name }}</h2>
              <p v-if="activeTab.description" class="mt-1 text-sm text-mist">{{ activeTab.description }}</p>
            </div>
            <AppActionMenu :items="actionItems(activeTab)" title="Acoes da aba" @select="handleAction(activeTab, $event)" />
          </div>

          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span class="label">Nome da aba</span>
              <input v-model="activeTab.name" class="input" @blur="syncTabKey(activeTab)">
            </label>
            <label>
              <span class="label">Tipo da aba</span>
              <select v-model="activeTab.type" class="select">
                <option v-for="type in tabTypes" :key="type" :value="type">{{ sheetTabTypeLabels[type] }}</option>
              </select>
            </label>
            <label class="md:col-span-2">
              <span class="label">Descricao opcional</span>
              <textarea v-model="activeTab.description" rows="2" class="input" />
            </label>
          </div>

          <div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label class="soft-row flex items-start gap-2 p-3 text-sm font-bold text-white"><input v-model="activeTab.readonly" type="checkbox" class="mt-1 accent-[var(--user-accent)]"><span><span class="block">Somente leitura</span><span class="block text-xs font-medium text-mist">Use para regras e informacoes que o jogador nao edita.</span></span></label>
            <label class="soft-row flex items-start gap-2 p-3 text-sm font-bold text-white"><input v-model="activeTab.allowRolls" type="checkbox" class="mt-1 accent-[var(--user-accent)]"><span><span class="block">Rolagens</span><span class="block text-xs font-medium text-mist">Exibe campos de formula como 1d20 + ATRIBUTO.</span></span></label>
            <label class="soft-row flex items-start gap-2 p-3 text-sm font-bold text-white"><input v-model="activeTab.allowDamageCostAbility" type="checkbox" class="mt-1 accent-[var(--user-accent)]"><span><span class="block">Dano, custo e habilidade</span><span class="block text-xs font-medium text-mist">Use para itens, armas, poderes e efeitos.</span></span></label>
          </div>

          <div v-if="advancedTabId === activeTab.id" class="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <h4 class="text-sm font-black text-white">Configuracoes avancadas</h4>
            <div class="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <label>
                <span class="label">Chave da aba</span>
                <input v-model="activeTab.key" class="input" @blur="activeTab.key = uniqueTabKey(activeTab.key, activeTab.id)">
              </label>
              <AppButton type="button" variant="ghost" class="self-end" @click="copyKey(activeTab.key)">Copiar chave</AppButton>
            </div>
            <p class="mt-2 text-xs leading-5 text-mist">A chave da aba organiza os dados. As chaves de registros abaixo sao as usadas em rolagens, modificacoes e formulas.</p>
            <div v-if="activeTab.tables?.length" class="mt-4 space-y-3">
              <div v-for="(table, tableIndex) in activeTab.tables" :key="table.id || tableIndex" class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <div class="flex items-center justify-between gap-2">
                  <input v-model="table.title" class="input" placeholder="Titulo da tabela">
                  <AppActionMenu :items="[{ key: 'delete', label: 'Apagar tabela', icon: Trash2, danger: true }]" title="Acoes da tabela" @select="$event === 'delete' && removeTable(activeTab.tables, tableIndex)" />
                </div>
                <div class="mt-3 overflow-x-auto">
                  <table class="min-w-full text-sm">
                    <thead><tr><th v-for="(_, columnIndex) in table.headers" :key="columnIndex" class="border border-white/10 p-1"><input v-model="table.headers[columnIndex]" class="input min-w-32"></th></tr></thead>
                    <tbody><tr v-for="(row, rowIndex) in table.rows" :key="rowIndex"><td v-for="(_, columnIndex) in table.headers" :key="columnIndex" class="border border-white/10 p-1"><input v-model="row[columnIndex]" class="input min-w-32"></td><td class="p-1"><button type="button" class="text-xs font-bold text-red-200" @click="removeTableRow(table, rowIndex)">Remover</button></td></tr></tbody>
                  </table>
                </div>
                <div class="mt-3 flex flex-wrap gap-2"><AppButton type="button" variant="ghost" @click="addTableRow(table)">Linha</AppButton><AppButton type="button" variant="ghost" @click="addTableColumn(table)">Coluna</AppButton><AppButton type="button" variant="subtle" @click="removeTableColumn(table, table.headers.length - 1)">Remover coluna</AppButton></div>
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard v-if="activeTab?.type === 'RULES'">
          <h3 class="text-lg font-black text-white">Texto Markdown do sistema</h3>
          <p class="muted mt-1">Este conteudo pertence ao sistema e aparece na ficha como leitura.</p>
          <textarea v-model="activeTab.systemMarkdown" rows="14" class="input mt-4" placeholder="# Regras de combate&#10;Escreva as regras gerais aqui." />
        </AppCard>

        <AppCard v-else-if="activeTab?.type === 'CLASS_PROGRESS'">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-black text-white">Classes e progresso</h3>
              <p class="muted mt-1">Configure textos, pontos livres e alteracoes aplicadas por nivel de classe.</p>
            </div>
            <AppButton type="button" @click="addClass"><Plus class="h-4 w-4" />Adicionar classe</AppButton>
          </div>

                    <div class="mt-5 space-y-4">
            <div v-for="(rpgClass, classIndex) in classes" :key="rpgClass.id || classIndex" class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div class="grid gap-3 lg:grid-cols-[1fr_120px_auto]">
                <label>
                  <span class="label">Nome da classe</span>
                  <input v-model="rpgClass.name" class="input" @blur="rpgClass.key = keyFromLabel(rpgClass.name)">
                </label>
                <label>
                  <span class="label">Niveis</span>
                  <input v-model.number="rpgClass.maxLevel" type="number" min="1" max="100" class="input" @change="resizeClassLevels(rpgClass)">
                </label>
                <AppActionMenu class="self-end" :items="[{ key: 'delete', label: 'Apagar classe', icon: Trash2, danger: true }]" title="Acoes da classe" @select="$event === 'delete' && removeClass(classIndex)" />
                <label class="lg:col-span-3">
                  <span class="label">Descricao</span>
                  <textarea v-model="rpgClass.description" rows="2" class="input" />
                </label>
              </div>

              <div class="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
                <div v-for="level in rpgClass.levels" :key="level.level" class="rounded-lg border border-white/10 bg-panel/70 p-3">
                  <div class="flex items-center justify-between gap-3">
                    <h4 class="font-black text-white">Nivel {{ level.level }}</h4>
                    <AppActionMenu title="Adicionar ao nivel" :items="levelActionItems()" @select="handleLevelAction(level, $event)">
                      <Plus class="h-4 w-4" />
                    </AppActionMenu>
                  </div>
                  <label class="mt-3 block">
                    <span class="label">Descricao opcional do nivel</span>
                    <textarea v-model="level.description" rows="2" class="input" placeholder="Treinamento, marco de classe ou explicacao do nivel." />
                  </label>
                  <div class="mt-3 space-y-2">
                    <div v-for="(change, changeIndex) in level.changes" :key="changeIndex" class="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2" :class="change.operation === 'NOTE' ? 'lg:grid-cols-[1fr_auto]' : 'lg:grid-cols-[1fr_110px_110px_1fr_auto]'">
                      <label v-if="change.operation === 'NOTE'"><span class="label">Texto na ficha</span><textarea v-model="change.note" rows="2" class="input" /></label>
                      <label v-else><span class="label">Alvo</span><select v-model="change.targetKey" class="select" @change="syncTargetLabel(change)"><option v-for="target in classTargets" :key="`${target.category}:${target.key}`" :value="target.key">{{ target.label }}</option></select><span v-if="change.type === 'ATTRIBUTE_POINT'" class="mt-1 block text-xs text-mist">Ponto para o jogador distribuir em qualquer atributo permitido.</span></label>
                      <label v-if="change.operation !== 'NOTE'"><span class="label">Regra</span><select v-model="change.operation" class="select"><option value="ADD">Somar</option><option value="SUBTRACT">Subtrair</option><option value="SET">Definir</option><option value="NOTE">Texto</option></select></label>
                      <label v-if="change.operation !== 'NOTE'"><span class="label">Valor</span><input v-model.number="change.value" type="number" class="input"></label>
                      <label v-if="change.operation !== 'NOTE'"><span class="label">Nota</span><input v-model="change.note" class="input"></label>
                      <AppActionMenu class="self-end" :items="[{ key: 'delete', label: 'Apagar alteracao', icon: Trash2, danger: true }]" title="Acoes da alteracao" @select="$event === 'delete' && removeLevelChange(level, changeIndex)" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard v-else-if="activeTab">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-black text-white">Registros e campos</h3>
              <p class="muted mt-1">Estes registros viram a estrutura que o personagem preenche.</p>
            </div>
            <AppButton type="button" @click="addRecord(activeTab)"><Plus class="h-4 w-4" />Adicionar {{ activeTab.name }}</AppButton>
          </div>

          <div v-if="activeTab.type === 'CUSTOM'" class="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div class="flex items-center justify-between gap-3">
              <h4 class="font-black text-white">Campos personalizados</h4>
              <AppButton type="button" variant="ghost" @click="addCustomField(activeTab)"><Plus class="h-4 w-4" />Campo</AppButton>
            </div>
            <div class="mt-3 space-y-3">
              <div v-for="(field, fieldIndex) in activeTab.fields || []" :key="field.id || fieldIndex" class="grid gap-3 rounded-lg border border-white/10 bg-panel/70 p-3 md:grid-cols-[1fr_170px_auto]">
                <label><span class="label">Nome do campo</span><input v-model="field.label" class="input" @blur="syncFieldKey(field)"></label>
                <label><span class="label">Tipo</span><select v-model="field.type" class="select"><option v-for="type in fieldTypes" :key="type" :value="type">{{ sheetFieldTypeLabels[type] }}</option></select></label>
                <AppActionMenu class="self-end" :items="[{ key: 'delete', label: 'Apagar campo', icon: Trash2, danger: true }]" title="Acoes do campo" @select="$event === 'delete' && removeCustomField(activeTab, fieldIndex)" />
                <label v-if="field.type === 'SELECT'" class="md:col-span-3"><span class="label">Opcoes separadas por virgula</span><input :value="field.options?.join(', ')" class="input" @input="field.options = ($event.target as HTMLInputElement).value.split(',').map((item) => item.trim()).filter(Boolean)"></label>
              </div>
            </div>
          </div>

          <div class="mt-5 space-y-3">
            <div v-for="(record, recordIndex) in activeTab.records || []" :key="record.id || recordIndex" class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div class="grid gap-3 md:grid-cols-[1fr_auto]">
                <label>
                  <span class="label">Nome</span>
                  <input v-model="record.name" class="input" placeholder="Nome do registro" @blur="record.key ||= formulaKeyFromLabel(record.name)">
                </label>
                <AppActionMenu class="self-end" :items="recordActionItems(record)" title="Acoes do registro" @select="handleRecordAction(activeTab, record, recordIndex, $event)" />
              </div>

              <div v-if="advancedRecordId === record.id" class="mt-3 rounded-lg border border-white/10 bg-panel/60 p-3">
                <h4 class="text-sm font-black text-white">Configuracoes avancadas</h4>
                <div class="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                  <label>
                    <span class="label">Chave da formula</span>
                    <input v-model="record.key" class="input font-mono" placeholder="POT" @blur="syncRecordKey(record)">
                  </label>
                  <AppButton type="button" variant="ghost" class="self-end" @click="copyKey(record.key)">Copiar chave</AppButton>
                </div>
                <p class="mt-2 text-xs leading-5 text-mist">Use esta chave em rolagens e formulas, como: 1d20 + {{ record.key || 'POT' }}.</p>
                <div v-if="record.effects?.length" class="mt-4 space-y-2">
                  <p class="text-xs font-black uppercase tracking-[0.12em] text-ember">Modificacoes do registro</p>
                  <div v-for="(effect, effectIndex) in record.effects" :key="effect.id || effectIndex" class="grid gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-2 lg:grid-cols-[1.2fr_130px_120px_1fr_auto]">
                    <label><span class="label">Alvo</span><select v-model="effect.targetKey" class="select" @change="syncEffectTarget(effect)"><option v-for="target in effectTargets" :key="`${target.type}:${target.key}`" :value="target.key">{{ target.label }}</option></select></label>
                    <label><span class="label">Regra</span><select v-model="effect.operation" class="select"><option v-for="operation in effectOperations" :key="operation.value" :value="operation.value">{{ operation.label }}</option></select></label>
                    <label><span class="label">Valor</span><FormulaTextInput v-model="effect.value" :variables="formulaVariables" placeholder="5 + FORCA" /></label>
                    <label><span class="label">Nota</span><input v-model="effect.note" class="input" placeholder="Enquanto equipado, escolhido etc."></label>
                    <AppActionMenu class="self-end" :items="[{ key: 'delete', label: 'Apagar efeito', icon: Trash2, danger: true }]" title="Acoes do efeito" @select="$event === 'delete' && removeEffect(record.effects, effectIndex)" />
                    <label class="flex items-center gap-2 text-xs font-bold text-mist lg:col-span-5"><input v-model="effect.perPoint" type="checkbox" class="accent-[var(--user-accent)]">Multiplicar pelo nivel/valor do registro. Ex.: Forca 2 com +5 gera +10.</label>
                  </div>
                </div>
                <div v-if="record.levels?.length" class="mt-4 space-y-3">
                  <p class="text-xs font-black uppercase tracking-[0.12em] text-ember">Niveis do registro</p>
                  <div v-for="(recordLevel, recordLevelIndex) in record.levels" :key="recordLevel.id || recordLevelIndex" class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <div class="grid gap-2 md:grid-cols-[100px_1fr_auto]"><label><span class="label">Nivel</span><input v-model.number="recordLevel.level" type="number" min="0" class="input"></label><label><span class="label">Nome</span><input v-model="recordLevel.name" class="input"></label><AppActionMenu class="self-end" :items="[{ key: 'delete', label: 'Apagar nivel', icon: Trash2, danger: true }]" title="Acoes do nivel" @select="$event === 'delete' && record.levels?.splice(recordLevelIndex, 1)" /></div>
                    <label class="mt-2 block"><span class="label">Descricao Markdown</span><textarea v-model="recordLevel.description" rows="2" class="input" /></label>
                    <div class="mt-2 flex justify-end"><AppButton type="button" variant="ghost" @click="addEffect(recordLevel)"><Plus class="h-4 w-4" />Efeito do nivel</AppButton></div>
                    <div v-for="(effect, effectIndex) in recordLevel.effects || []" :key="effect.id || effectIndex" class="mt-2 grid gap-2 rounded-lg border border-white/10 bg-panel/70 p-2 md:grid-cols-[1fr_120px_100px_auto]"><select v-model="effect.targetKey" class="select" @change="syncEffectTarget(effect)"><option v-for="target in effectTargets" :key="`${target.type}:${target.key}`" :value="target.key">{{ target.label }}</option></select><select v-model="effect.operation" class="select"><option v-for="operation in effectOperations" :key="operation.value" :value="operation.value">{{ operation.label }}</option></select><input v-model="effect.value" class="input"><AppActionMenu :items="[{ key: 'delete', label: 'Apagar efeito', icon: Trash2, danger: true }]" title="Acoes do efeito" @select="$event === 'delete' && removeEffect(recordLevel.effects, effectIndex)" /></div>
                  </div>
                </div>
                <div v-if="record.tables?.length" class="mt-4 space-y-3">
                  <p class="text-xs font-black uppercase tracking-[0.12em] text-ember">Tabelas do registro</p>
                  <div v-for="(table, tableIndex) in record.tables" :key="table.id || tableIndex" class="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <div class="flex items-center justify-between gap-2"><input v-model="table.title" class="input" placeholder="Titulo da tabela"><AppActionMenu :items="[{ key: 'delete', label: 'Apagar tabela', icon: Trash2, danger: true }]" title="Acoes da tabela" @select="$event === 'delete' && removeTable(record.tables, tableIndex)" /></div>
                    <div class="mt-3 overflow-x-auto"><table class="min-w-full text-sm"><thead><tr><th v-for="(_, columnIndex) in table.headers" :key="columnIndex" class="border border-white/10 p-1"><input v-model="table.headers[columnIndex]" class="input min-w-32"></th></tr></thead><tbody><tr v-for="(row, rowIndex) in table.rows" :key="rowIndex"><td v-for="(_, columnIndex) in table.headers" :key="columnIndex" class="border border-white/10 p-1"><input v-model="row[columnIndex]" class="input min-w-32"></td><td class="p-1"><button type="button" class="text-xs font-bold text-red-200" @click="removeTableRow(table, rowIndex)">Remover</button></td></tr></tbody></table></div>
                    <div class="mt-3 flex flex-wrap gap-2"><AppButton type="button" variant="ghost" @click="addTableRow(table)">Linha</AppButton><AppButton type="button" variant="ghost" @click="addTableColumn(table)">Coluna</AppButton><AppButton type="button" variant="subtle" @click="removeTableColumn(table, table.headers.length - 1)">Remover coluna</AppButton></div>
                  </div>
                </div>
              </div>

              <div class="mt-3 grid gap-3 md:grid-cols-2">
                <label v-if="['ATTRIBUTES', 'RESOURCES', 'SKILLS'].includes(activeTab.type)">
                  <span class="label">Valor padrao</span>
                  <FormulaTextInput v-model="record.value" :variables="formulaVariables" placeholder="10 + FORCA" />
                </label>
                <label v-if="activeTab.type === 'ATTRIBUTES'">
                  <span class="label">Limite minimo</span>
                  <input v-model.number="record.min" type="number" class="input" placeholder="Opcional">
                </label>
                <label v-if="['ATTRIBUTES', 'RESOURCES'].includes(activeTab.type)">
                  <span class="label">{{ activeTab.type === 'RESOURCES' ? 'Valor maximo' : 'Limite maximo' }}</span>
                  <input v-model="record.max" class="input" placeholder="Opcional ou formula">
                </label>
                <label v-if="activeTab.type === 'SKILLS'">
                  <span class="label">Atributo relacionado</span>
                  <input v-model="record.relatedAttribute" class="input" placeholder="Opcional">
                </label>
                <label v-if="activeTab.allowDamageCostAbility">
                  <span class="label">Dano</span>
                  <FormulaTextInput v-model="record.damage" :variables="formulaVariables" placeholder="1d8 + POT" />
                </label>
                <label v-if="activeTab.allowDamageCostAbility && activeTab.type === 'POWERS'">
                  <span class="label">Custo</span>
                  <input v-model="record.cost" class="input" placeholder="2 PE">
                </label>
                <label v-if="activeTab.allowDamageCostAbility && activeTab.type === 'POWERS'">
                  <span class="label">Alcance</span>
                  <input v-model="record.range" class="input" placeholder="Curto">
                </label>
                <label v-if="activeTab.allowDamageCostAbility && ['WEAPONS', 'ITEMS'].includes(activeTab.type)">
                  <span class="label">Habilidade</span>
                  <textarea v-model="record.ability" rows="3" class="input" placeholder="Opcional. Aceita descricao longa ou Markdown." />
                </label>
                <label v-if="['ITEMS', 'WEAPONS'].includes(activeTab.type)">
                  <span class="label">Peso</span>
                  <input v-model.number="record.weight" type="number" min="0" class="input" placeholder="0">
                </label>
                <label v-if="activeTab.allowRolls">
                  <span class="label">Rolagem</span>
                  <FormulaTextInput v-model="record.roll" :variables="formulaVariables" placeholder="1d20 + POT" />
                </label>
                <label v-if="false && activeTab.allowBonuses">
                  <span class="label">Bonus / aumento</span>
                  <FormulaTextInput v-model="record.bonus" :variables="formulaVariables" placeholder="+1 POT" />
                </label>
                <label v-if="false && activeTab.allowBonuses">
                  <span class="label">Chave do bonus</span>
                  <input v-model="record.bonusKey" class="input font-mono" placeholder="BONUS_ATK" @blur="record.bonusKey = record.bonusKey ? formulaKeyFromLabel(record.bonusKey) : undefined">
                </label>
                <label v-if="activeTab.type === 'ITEMS'">
                  <span class="label">Quantidade padrao *</span>
                  <input v-model.number="record.quantity" type="number" min="1" class="input" placeholder="1">
                  <span class="mt-1 block text-xs text-mist">Obrigatorio. Use 1 quando o item for unico.</span>
                </label>
                <label class="md:col-span-2">
                  <span class="label">Texto / descricao</span>
                  <textarea v-model="record.description" rows="3" class="input" />
                </label>
              </div>

              <div v-if="activeTab.type === 'SKILLS'" class="mt-3 rounded-lg border border-white/10 bg-panel/60 p-3">
                <label class="flex items-center gap-2 text-sm font-bold text-white">
                  <input v-model="record.useSkillLevels" type="checkbox" class="accent-[var(--user-accent)]">
                  Usar niveis nesta pericia
                </label>
                <div v-if="record.useSkillLevels" class="mt-3 space-y-2">
                  <div v-for="(level, levelIndex) in record.skillLevels || []" :key="level.id || levelIndex" class="grid gap-2 md:grid-cols-[1fr_140px_110px_auto]">
                    <input v-model="level.name" class="input" placeholder="Treinado" @blur="syncSkillLevelKey(level)">
                    <input v-model="level.key" class="input font-mono" placeholder="TREINADO" @blur="syncSkillLevelKey(level)">
                    <input v-model.number="level.value" type="number" class="input" placeholder="+5">
                    <AppActionMenu :items="[{ key: 'delete', label: 'Apagar nivel', icon: Trash2, danger: true }]" title="Acoes do nivel" @select="$event === 'delete' && removeSkillLevel(record, levelIndex)" />
                  </div>
                  <AppButton type="button" variant="ghost" @click="addSkillLevel(record)"><Plus class="h-4 w-4" />Nivel da pericia</AppButton>
                </div>
              </div>

              <div v-if="activeTab.type === 'CUSTOM' && activeTab.fields?.length" class="mt-3 grid gap-3 md:grid-cols-2">
                <label v-for="field in activeTab.fields" :key="field.id || field.key" :class="['LONG_TEXT', 'LIST'].includes(field.type) ? 'md:col-span-2' : ''">
                  <span class="label">{{ field.label }}</span>
                  <textarea v-if="field.type === 'LONG_TEXT'" :value="String(fieldValue(record, field.key) ?? field.defaultValue ?? '')" rows="3" class="input" @input="setFieldValue(record, field.key, ($event.target as HTMLTextAreaElement).value)" />
                  <input v-else-if="field.type === 'NUMBER'" :value="fieldValue(record, field.key) ?? field.defaultValue ?? 0" type="number" class="input" @input="setFieldValue(record, field.key, Number(($event.target as HTMLInputElement).value))">
                  <select v-else-if="field.type === 'SELECT'" :value="String(fieldValue(record, field.key) ?? field.defaultValue ?? '')" class="select" @change="setFieldValue(record, field.key, ($event.target as HTMLSelectElement).value)">
                    <option v-for="option in field.options || []" :key="option" :value="option">{{ option }}</option>
                  </select>
                  <input v-else :value="String(fieldValue(record, field.key) ?? field.defaultValue ?? '')" class="input" @input="setFieldValue(record, field.key, ($event.target as HTMLInputElement).value)">
                </label>
              </div>
            </div>

            <EmptyState v-if="!(activeTab.records || []).length" :icon="FileText" title="Nenhum registro criado" description="Adicione os blocos, itens, atributos ou modelos que vao aparecer para o personagem preencher.">
              <AppButton type="button" @click="addRecord(activeTab)"><Plus class="h-4 w-4" />Adicionar</AppButton>
            </EmptyState>
          </div>
        </AppCard>

        <AppCard>
          <h3 class="text-lg font-black text-white">Preview da ficha</h3>
          <div v-if="previewTabs.length" class="mt-4 grid gap-3 md:grid-cols-2">
            <div v-for="tab in previewTabs" :key="tab.id || tab.key" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-black text-white">{{ tab.name }}</p>
                  <p class="mt-1 text-xs text-mist">{{ sheetTabTypeLabels[tab.type] }} | {{ tab.readonly ? 'Leitura' : 'Editavel' }}</p>
                </div>
                <span class="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-mist">{{ tab.records?.length || (tab.type === 'RULES' ? 1 : 0) }}</span>
              </div>
              <p v-if="tab.description" class="mt-2 text-sm leading-6 text-mist">{{ tab.description }}</p>
            </div>
          </div>
          <p v-else class="mt-4 rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">A ficha ainda nao tem abas criadas.</p>
        </AppCard>

        <AppCard>
          <h2 class="text-xl font-black text-white">Publicar sistema</h2>
          <p class="mt-2 text-mist">Revise a estrutura, escolha a visibilidade no cadastro do sistema e salve.</p>
          <slot name="publish" />
        </AppCard>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="createOpen" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" @click.self="createOpen = false">
        <div class="w-full max-w-2xl rounded-xl border border-white/10 bg-panel p-5 shadow-soft">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-xl font-black text-white">Criar aba da ficha</h2>
              <p class="mt-1 text-sm text-mist">Escolha um tipo pronto ou use uma aba personalizada.</p>
            </div>
            <button type="button" class="rounded-lg border border-white/10 p-2 text-mist hover:text-white" @click="createOpen = false"><X class="h-4 w-4" /></button>
          </div>
          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span class="label">Tipo da aba</span>
              <select v-model="selectedType" class="select" @change="newTabName = sheetTabTypeLabels[selectedType]">
                <option v-for="type in tabTypes" :key="type" :value="type">{{ sheetTabTypeLabels[type] }}</option>
              </select>
            </label>
            <label>
              <span class="label">Nome da aba</span>
              <input v-model="newTabName" class="input" placeholder="Armas, Magias, Biografia...">
            </label>
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <AppButton type="button" variant="ghost" @click="createOpen = false">Cancelar</AppButton>
            <AppButton type="button" @click="createTab"><Plus class="h-4 w-4" />Criar aba</AppButton>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmModal
      :open="Boolean(pendingDeleteTab)"
      title="Apagar aba?"
      message="Apagar esta aba remove a estrutura do sistema. Dados ja salvos em personagens ficam preservados no JSON, mas deixam de aparecer enquanto a aba nao existir."
      confirm-label="Apagar aba"
      @close="pendingDeleteTab = null"
      @confirm="confirmDeleteTab"
    />

    <ConfirmModal
      :open="Boolean(pendingDeleteRecord)"
      title="Apagar registro?"
      :message="`Apagar ${pendingDeleteRecord?.name || 'este registro'} remove esta opcao do sistema e pode afetar fichas que usam essa escolha.`"
      confirm-label="Apagar registro"
      @close="pendingDeleteRecord = null"
      @confirm="confirmDeleteRecord"
    />

    <ConfirmModal
      :open="pendingDeleteLevelIndex !== null"
      title="Apagar nivel?"
      message="Este nivel deixara de aplicar limites globais para personagens novos ou editados."
      confirm-label="Apagar nivel"
      @close="pendingDeleteLevelIndex = null"
      @confirm="confirmDeleteLevelRule"
    />
  </div>
</template>

