<script setup lang="ts">
import { ChevronDown, Info, Plus, Trash2 } from 'lucide-vue-next'
import type { DynamicField, SheetTab, SheetTabRecord, SystemSchema } from '../../shared/types/system'
import { keyFromLabel, normalizeSheetTabs, sheetTabTypeLabels } from '~~/shared/utils/sheetTabs'
import { validateCharacterData } from '~~/shared/utils/characterRules'
import { classNotes, fieldSources } from '../utils/characterProgression'

type ExtraField = { id: string; name: string; value: string }
type SheetListItem = { id: string; name: string; description: string; damage?: string; skill?: string; extras?: ExtraField[] }
type SheetTextBlock = { name: string; description: string }
type TabItem = SheetListItem & {
  sourceRecordKey?: string
  roll?: string
  cost?: string
  range?: string
  ability?: string
  bonus?: string
  effect?: string
  weight?: number | null
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
  fields?: Record<string, unknown>
}

const props = defineProps<{
  character: {
    id: string
    name: string
    description?: string | null
    avatarUrl?: string | null
    moderationStatus?: string | null
    moderationReason?: string | null
    dataJson: Record<string, unknown>
    system: { name: string; schemaJson?: SystemSchema; fields: DynamicField[] }
  }
  roomId?: string
  editable?: boolean
  autosave?: boolean
}>()

const emit = defineEmits<{ saved: [] }>()
const { push, apiError } = useToast()
const draft = reactive<Record<string, unknown>>({ ...props.character.dataJson })
const meta = reactive({
  avatarUrl: props.character.avatarUrl || '',
  description: props.character.description || ''
})
const saving = ref(false)
const publishing = ref(false)
const saveIntentOpen = ref(false)
const openGroups = ref(new Set<string>())
const sourceField = ref<DynamicField | null>(null)
const savedAt = ref<Date | null>(null)
const autosaveReady = ref(false)
const syncing = ref(false)
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
const className = computed(() => {
  const classKey = String(props.character.dataJson.classe || '')
  if (!classKey) return ''
  return props.character.system.schemaJson?.classes?.find((item) => item.key === classKey)?.name || classKey
})
const isRejected = computed(() => props.character.moderationStatus === 'REJECTED')
const sheetTabs = computed(() => normalizeSheetTabs(props.character.system.schemaJson))
const tabFieldKeys = computed(() => new Set(sheetTabs.value.flatMap((tab) => (tab.records || []).map((record) => keyFromLabel(`${tab.key}_${record.name}`)))))
const sheetLists = computed(() => sheetTabs.value.length ? [] : (props.character.system.schemaJson?.sheetLists || []).filter((list) => list.enabled !== false))
const visibleClassNotes = computed(() => classNotes(props.character.system.schemaJson, draft))
const selectedFieldSources = computed(() => sourceField.value ? fieldSources(sourceField.value, props.character.system.schemaJson, draft) : [])
const builtInSections = computed(() => {
  if (sheetTabs.value.length) return []
  const configured = props.character.system.schemaJson?.sheetSections
  if (!configured?.length) return []

  return configured
    .filter((section) => section.enabled !== false)
    .map((section) => ({
      key: section.key,
      title: section.title,
      multiple: Boolean(section.multiple),
      damage: Boolean(section.allowDamage),
      skill: Boolean(section.allowSkill),
      extras: Boolean(section.allowExtras)
    }))
})
const rulesMarkdown = computed(() => sheetTabs.value.some((tab) => tab.type === 'RULES') ? '' : props.character.system.schemaJson?.rulesMarkdown || '')

const groups = computed(() => {
  const order = ['ATTRIBUTE', 'RESOURCE', 'SKILL', 'TEXT_FIELD', 'NUMERIC_FIELD', 'BOOLEAN_FIELD', 'LIST_FIELD', 'FORMULA', 'ROLL_RULE', 'STATUS_BAR']
  return order
    .map((category) => ({
      category,
      fields: props.character.system.fields.filter((field) => field.category === category && !tabFieldKeys.value.has(field.key))
    }))
    .filter((group) => group.fields.length > 0)
})

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    ATTRIBUTE: 'Atributos',
    RESOURCE: 'Recursos',
    SKILL: 'Pericias',
    TEXT_FIELD: 'Informacoes',
    NUMERIC_FIELD: 'Numeros',
    BOOLEAN_FIELD: 'Marcadores',
    LIST_FIELD: 'Listas',
    FORMULA: 'Formulas',
    ROLL_RULE: 'Rolagens',
    STATUS_BAR: 'Estado'
  }
  return labels[category] || category
}

function isGroupOpen(category: string) {
  return openGroups.value.has(category)
}

function toggleGroup(category: string) {
  const next = new Set(openGroups.value)
  if (next.has(category)) next.delete(category)
  else next.add(category)
  openGroups.value = next
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function listItems(key: string): SheetListItem[] {
  if (!Array.isArray(draft[key])) draft[key] = []
  return draft[key] as SheetListItem[]
}

function tabRecordKey(record: SheetTabRecord, index: number) {
  return record.key || record.id || keyFromLabel(record.name || `registro_${index + 1}`)
}

function tabRecordValues(tab: SheetTab): Record<string, TabRecordValue> {
  if (!draft[tab.key] || typeof draft[tab.key] !== 'object' || Array.isArray(draft[tab.key])) draft[tab.key] = {}
  const values = draft[tab.key] as Record<string, TabRecordValue>
  ;(tab.records || []).forEach((record, index) => {
    const key = tabRecordKey(record, index)
    if (!values[key]) values[key] = defaultRecordValue(tab, record)
  })
  return values
}

function tabRecordValue(tab: SheetTab, record: SheetTabRecord, index: number) {
  return tabRecordValues(tab)[tabRecordKey(record, index)] || defaultRecordValue(tab, record)
}

function skillState(tab: SheetTab, record: SheetTabRecord, index: number) {
  const values = tabRecordValues(tab)
  const key = tabRecordKey(record, index)
  values[key] ||= defaultRecordValue(tab, record)
  return values[key] as TabRecordValue & { selected?: boolean; levelKey?: string }
}

function setSkillSelected(tab: SheetTab, record: SheetTabRecord, index: number, selected: boolean) {
  const state = skillState(tab, record, index)
  state.selected = selected
  if (selected && record.useSkillLevels && !state.levelKey) {
    const first = record.skillLevels?.[0]
    state.levelKey = first?.key || ''
    state.value = first?.value ?? 0
    if (record.key) draft[record.key] = state.value
  }
}

function setSkillLevel(tab: SheetTab, record: SheetTabRecord, index: number, levelKey: string) {
  const state = skillState(tab, record, index)
  const level = record.skillLevels?.find((item) => item.key === levelKey)
  state.levelKey = levelKey
  state.value = level?.value ?? 0
  if (record.key) draft[record.key] = state.value
}

function setTabRecordValue(tab: SheetTab, record: SheetTabRecord, index: number, key: keyof TabRecordValue, value: unknown) {
  const values = tabRecordValues(tab)
  const recordKey = tabRecordKey(record, index)
  values[recordKey] ||= defaultRecordValue(tab, record)
  values[recordKey][key] = value as never
  if (record.key && ['value', 'current', 'max'].includes(String(key))) draft[record.key] = value
}

function defaultRecordValue(tab: SheetTab, record: SheetTabRecord): TabRecordValue {
  if (tab.type === 'RESOURCES') {
    return { name: record.name, current: record.value ?? 0, max: record.max ?? '', description: record.description || '' }
  }
  if (tab.type === 'TEXT_BLOCKS') {
    return { name: record.name, text: record.text || record.description || '' }
  }
  if (tab.type === 'ROLLS') {
    return { name: record.name, roll: record.roll || '', description: record.description || '' }
  }
  return { name: record.name, value: record.value ?? '', description: record.description || '', relatedAttribute: record.relatedAttribute || '' }
}

function tabItems(tab: SheetTab): TabItem[] {
  if (!Array.isArray(draft[tab.key])) {
    draft[tab.key] = (tab.records || []).map((record) => defaultTabItem(tab, record))
  }
  ;(draft[tab.key] as TabItem[]).forEach((item) => {
    item.fields ||= {}
    item.extras ||= []
  })
  return draft[tab.key] as TabItem[]
}

function defaultTabItem(tab: SheetTab, record?: SheetTabRecord): TabItem {
  return {
    id: uid(tab.key),
    sourceRecordKey: record?.key || '',
    name: record?.name || '',
    description: record?.description || record?.text || '',
    damage: record?.damage || '',
    weight: record?.weight ?? null,
    skill: record?.ability || '',
    roll: record?.roll || '',
    cost: record?.cost || '',
    range: record?.range || '',
    ability: record?.ability || '',
    bonus: record?.bonus || '',
    effect: record?.effect || '',
    quantity: record?.quantity ?? null,
    extras: (record?.extraFields || []).map((extra) => ({ id: extra.id || uid('extra'), name: extra.name, value: extra.value })),
    fields: { ...(record?.fields || {}) }
  }
}

function addTabItem(tab: SheetTab) {
  tabItems(tab).push(defaultTabItem(tab))
}

function selectedRecordItem(tab: SheetTab, record: SheetTabRecord) {
  const key = record.key || keyFromLabel(record.name)
  return tabItems(tab).find((item) => item.sourceRecordKey === key || item.name === record.name)
}

function toggleRecordItem(tab: SheetTab, record: SheetTabRecord) {
  const key = record.key || keyFromLabel(record.name)
  const items = tabItems(tab)
  const index = items.findIndex((item) => item.sourceRecordKey === key || item.name === record.name)
  if (index >= 0) items.splice(index, 1)
  else items.push(defaultTabItem(tab, record))
}

function removeTabItem(tab: SheetTab, index: number) {
  tabItems(tab).splice(index, 1)
}

function addButtonLabel(tab: SheetTab) {
  const labels: Partial<Record<string, string>> = {
    ITEMS: 'item',
    WEAPONS: 'arma',
    TRAITS: 'traco',
    POWERS: 'poder',
    TEXT_BLOCKS: 'bloco',
    CONDITIONS: 'condicao',
    CUSTOM: tab.name.toLowerCase()
  }
  return `Adicionar ${labels[tab.type] || 'registro'}`
}

function tabReadonly(tab: SheetTab) {
  return !props.editable || tab.readonly
}

function singleBlock(key: string): SheetTextBlock {
  if (!draft[key] || typeof draft[key] !== 'object' || Array.isArray(draft[key])) {
    draft[key] = { name: '', description: '' }
  }
  return draft[key] as SheetTextBlock
}

function addListItem(key: string) {
  listItems(key).push({ id: uid(key), name: '', description: '', damage: '', skill: '', extras: [] })
}

function removeListItem(key: string, index: number) {
  listItems(key).splice(index, 1)
}

function addExtra(item: SheetListItem) {
  item.extras ||= []
  item.extras.push({ id: uid('extra'), name: '', value: '' })
}

function removeExtra(item: SheetListItem, index: number) {
  item.extras?.splice(index, 1)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderMarkdown(value: unknown) {
  const escaped = escapeHtml(String(value || ''))
  return escaped
    .replace(/^### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^## (.*)$/gm, '<h3>$1</h3>')
    .replace(/^# (.*)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

function sourceItems() {
  return [{ key: 'source', label: 'Origem do valor', icon: Info }]
}

function handleFieldAction(field: DynamicField, action: string) {
  if (action === 'source') sourceField.value = field
}

async function save(silent = false, publish = false) {
  if (!props.editable || isRejected.value) return
  const validationErrors = validateCharacterData(props.character.system.schemaJson, props.character.system.fields, draft)
  if (validationErrors.length) {
    push(validationErrors[0] || 'A ficha tem valores fora das regras do sistema.', 'error')
    saveIntentOpen.value = false
    return
  }
  saving.value = true
  try {
    const payload = { ...draft }
    await $fetch(`/api/characters/${props.character.id}`, {
      method: 'PUT',
      body: { dataJson: payload, avatarUrl: meta.avatarUrl, description: meta.description }
    })
    savedAt.value = new Date()
    if (!silent) push('Ficha salva.', 'success')
    if (publish) await publishCharacter()
    emit('saved')
  } catch (error) {
    apiError(error, 'Nao foi possivel salvar a ficha.')
  } finally {
    saving.value = false
    saveIntentOpen.value = false
  }
}

async function publishCharacter() {
  if (isRejected.value) return
  publishing.value = true
  try {
    await $fetch(`/api/characters/${props.character.id}/publish`, { method: 'POST' })
    push('Personagem enviado para analise da comunidade.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel publicar o personagem.')
  } finally {
    publishing.value = false
  }
}

watch(() => props.character.dataJson, (next) => {
  syncing.value = true
  for (const key of Object.keys(draft)) {
    if (!(key in next)) delete draft[key]
  }
  Object.assign(draft, next)
  meta.avatarUrl = props.character.avatarUrl || ''
  meta.description = props.character.description || ''
  nextTick(() => {
    syncing.value = false
  })
}, { deep: true })

watch(draft, () => {
  if (!props.autosave || !props.editable || !autosaveReady.value || syncing.value) return
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => save(true), 650)
}, { deep: true })

onMounted(() => {
  autosaveReady.value = true
})

onBeforeUnmount(() => {
  if (autosaveTimer) clearTimeout(autosaveTimer)
})
</script>

<template>
  <div class="space-y-5">
    <CharacterSummaryCard
      :character="character"
      :avatar-url="meta.avatarUrl"
      :description="meta.description"
      :class-name="className"
      :editable="editable"
      :room-id="roomId"
      :is-rejected="isRejected"
      :moderation-reason="character.moderationReason"
      :saving="saving"
      :publishing="publishing"
      :saved-at="savedAt"
      @update-avatar="meta.avatarUrl = $event"
      @update-description="meta.description = $event"
      @save="saveIntentOpen = true"
    />

    <div class="space-y-5">
      <AppCard v-if="visibleClassNotes.length" class="border-ember/25 bg-ember/5">
        <h2 class="text-lg font-black text-white">Textos da classe</h2>
        <div class="mt-3 space-y-2">
          <p v-for="item in visibleClassNotes" :key="`${item.level}-${item.note}`" class="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-mist">
            <b class="text-ember">{{ item.title }} nivel {{ item.level }}:</b> {{ item.note }}
          </p>
        </div>
      </AppCard>

      <AppCard v-for="tab in sheetTabs" :key="tab.id || tab.key">
        <button type="button" class="flex w-full items-center justify-between gap-3 text-left" @click="toggleGroup(`tab:${tab.key}`)">
          <span>
            <h2 class="text-lg font-black text-white">{{ tab.name }}</h2>
            <p class="mt-1 text-sm text-mist">{{ tab.description || sheetTabTypeLabels[tab.type] }}</p>
          </span>
          <ChevronDown class="h-5 w-5 text-ember transition" :class="isGroupOpen(`tab:${tab.key}`) ? 'rotate-180' : ''" />
        </button>

        <div v-if="isGroupOpen(`tab:${tab.key}`)" class="mt-4">
          <div v-if="tab.type === 'RULES'" class="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-mist">
            <div class="markdown-preview" v-html="renderMarkdown(tab.systemMarkdown || '')" />
          </div>

          <div v-else-if="['ATTRIBUTES', 'SKILLS', 'ROLLS', 'TEXT_BLOCKS'].includes(tab.type)" class="sheet-record-grid">
            <div v-for="(record, recordIndex) in tab.records || []" :key="record.id || recordIndex" class="rounded-lg border border-white/10 bg-white/[0.04] p-3" :class="['TEXT_BLOCKS', 'ROLLS'].includes(tab.type) ? 'sheet-record-wide' : ''">
              <div class="flex items-start justify-between gap-3">
                <h3 class="font-black text-white">{{ record.name }}</h3>
                <label v-if="tab.type === 'SKILLS'" class="flex items-center gap-2 text-xs font-bold text-mist">
                  <input :checked="Boolean(skillState(tab, record, recordIndex).selected)" type="checkbox" class="accent-ember" :disabled="tabReadonly(tab)" @change="setSkillSelected(tab, record, recordIndex, ($event.target as HTMLInputElement).checked)">
                  Escolher
                </label>
              </div>
              <p v-if="record.description" class="mt-1 text-sm text-mist">{{ record.description }}</p>
              <div class="sheet-field-grid mt-3">
                <label v-if="['ATTRIBUTES', 'SKILLS'].includes(tab.type)">
                  <span class="label">Valor</span>
                  <select v-if="tab.type === 'SKILLS' && record.useSkillLevels" :value="skillState(tab, record, recordIndex).levelKey || ''" class="select" :disabled="tabReadonly(tab) || !skillState(tab, record, recordIndex).selected" @change="setSkillLevel(tab, record, recordIndex, ($event.target as HTMLSelectElement).value)">
                    <option value="">Escolha o nivel</option>
                    <option v-for="level in record.skillLevels || []" :key="level.key" :value="level.key">{{ level.name }} ({{ level.value >= 0 ? '+' : '' }}{{ level.value }})</option>
                  </select>
                  <input v-else :value="tabRecordValue(tab, record, recordIndex).value as string | number" type="number" class="input" :readonly="tabReadonly(tab) || (tab.type === 'SKILLS' && !skillState(tab, record, recordIndex).selected)" @input="setTabRecordValue(tab, record, recordIndex, 'value', Number(($event.target as HTMLInputElement).value))">
                </label>
                <label v-if="tab.type === 'SKILLS'">
                  <span class="label">Atributo relacionado</span>
                  <input :value="String(tabRecordValue(tab, record, recordIndex).relatedAttribute || '')" class="input" :readonly="tabReadonly(tab)" @input="setTabRecordValue(tab, record, recordIndex, 'relatedAttribute', ($event.target as HTMLInputElement).value)">
                </label>
                <label v-if="tab.type === 'ROLLS'" class="sheet-field-wide">
                  <span class="label">Formula</span>
                  <input :value="String(tabRecordValue(tab, record, recordIndex).roll || '')" class="input" :readonly="tabReadonly(tab)" placeholder="1d20 + atributo" @input="setTabRecordValue(tab, record, recordIndex, 'roll', ($event.target as HTMLInputElement).value)">
                </label>
                <label v-if="tab.type === 'TEXT_BLOCKS'" class="sheet-field-wide">
                  <span class="label">Texto</span>
                  <textarea :value="String(tabRecordValue(tab, record, recordIndex).text || '')" rows="5" class="input" :readonly="tabReadonly(tab)" @input="setTabRecordValue(tab, record, recordIndex, 'text', ($event.target as HTMLTextAreaElement).value)" />
                </label>
              </div>
            </div>
            <p v-if="!(tab.records || []).length" class="sheet-record-wide rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">Nenhum registro definido nesta aba.</p>
          </div>

          <div v-else-if="tab.type === 'RESOURCES'" class="sheet-record-grid">
            <div v-for="(record, recordIndex) in tab.records || []" :key="record.id || recordIndex" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <h3 class="font-black text-white">{{ record.name }}</h3>
              <div class="sheet-resource-grid mt-3">
                <label>
                  <span class="label">Atual</span>
                  <input :value="tabRecordValue(tab, record, recordIndex).current as string | number" type="number" class="input" :readonly="tabReadonly(tab)" @input="setTabRecordValue(tab, record, recordIndex, 'current', Number(($event.target as HTMLInputElement).value))">
                </label>
                <label>
                  <span class="label">Maximo</span>
                  <input :value="tabRecordValue(tab, record, recordIndex).max as string | number" type="number" class="input" :readonly="tabReadonly(tab)" @input="setTabRecordValue(tab, record, recordIndex, 'max', Number(($event.target as HTMLInputElement).value))">
                </label>
              </div>
              <p v-if="record.description" class="mt-2 text-sm text-mist">{{ record.description }}</p>
            </div>
          </div>

          <div v-else-if="tab.type === 'CLASS_PROGRESS'" class="space-y-3">
            <p v-if="className" class="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-mist">Classe atual: <b class="text-white">{{ className }}</b></p>
            <p v-if="!className" class="rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">Classe ainda nao escolhida para este personagem.</p>
          </div>

          <div v-else-if="['ITEMS', 'WEAPONS', 'TRAITS', 'POWERS', 'CONDITIONS'].includes(tab.type) && (tab.records || []).length" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <button
              v-for="record in tab.records || []"
              :key="record.key || record.id || record.name"
              type="button"
              class="min-h-32 rounded-lg border p-4 text-left transition"
              :class="selectedRecordItem(tab, record) ? 'border-ember/50 bg-ember/10 shadow-[0_0_0_1px_rgba(255,138,19,0.12)]' : 'border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]'"
              :disabled="tabReadonly(tab)"
              @click="toggleRecordItem(tab, record)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="truncate text-lg font-black text-white">{{ record.name }}</h3>
                  <p v-if="record.description || record.text" class="mt-1 text-sm leading-6 text-mist">{{ record.description || record.text }}</p>
                </div>
                <span class="shrink-0 rounded-md border px-2 py-1 text-xs font-bold" :class="selectedRecordItem(tab, record) ? 'border-ember/35 bg-ember/15 text-ember' : 'border-white/10 text-mist'">{{ selectedRecordItem(tab, record) ? 'Escolhido' : 'Escolher' }}</span>
              </div>
              <div class="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                <span v-if="record.damage" class="rounded-md border border-white/10 bg-panel/60 px-2 py-1 text-mist">Dano {{ record.damage }}</span>
                <span v-if="record.roll" class="rounded-md border border-white/10 bg-panel/60 px-2 py-1 text-mist">Rolagem {{ record.roll }}</span>
                <span v-if="record.bonus" class="rounded-md border border-white/10 bg-panel/60 px-2 py-1 text-mist">{{ record.bonus }}</span>
                <span v-if="record.weight" class="rounded-md border border-white/10 bg-panel/60 px-2 py-1 text-mist">Peso {{ record.weight }}</span>
              </div>
            </button>
          </div>

          <div v-else class="space-y-3">
            <div v-for="(item, index) in tabItems(tab)" :key="item.id || index" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div class="grid gap-3 md:grid-cols-[1fr_150px_150px_auto]">
                <label>
                  <span class="label">Nome</span>
                  <input v-model="item.name" class="input" :readonly="tabReadonly(tab)" placeholder="Nome">
                </label>
                <label v-if="tab.allowDamageCostAbility">
                  <span class="label">Dano</span>
                  <input v-model="item.damage" class="input" :readonly="tabReadonly(tab)" placeholder="1d8">
                </label>
                <label v-if="['ITEMS', 'WEAPONS'].includes(tab.type)">
                  <span class="label">Peso</span>
                  <input v-model.number="item.weight" type="number" class="input" :readonly="tabReadonly(tab)">
                </label>
                <label v-if="tab.allowRolls">
                  <span class="label">Rolagem</span>
                  <input v-model="item.roll" class="input" :readonly="tabReadonly(tab)" placeholder="1d20 + atributo">
                </label>
                <AppActionMenu v-if="!tabReadonly(tab)" class="self-end" :items="[{ key: 'delete', label: 'Remover', icon: Trash2, danger: true }]" title="Acoes do item" @select="$event === 'delete' && removeTabItem(tab, index)" />
                <label v-if="tab.allowDamageCostAbility && tab.type === 'POWERS'">
                  <span class="label">Custo</span>
                  <input v-model="item.cost" class="input" :readonly="tabReadonly(tab)" placeholder="2 PE">
                </label>
                <label v-if="tab.allowDamageCostAbility && tab.type === 'POWERS'">
                  <span class="label">Alcance</span>
                  <input v-model="item.range" class="input" :readonly="tabReadonly(tab)" placeholder="Curto">
                </label>
                <label v-if="tab.allowDamageCostAbility && ['WEAPONS', 'ITEMS'].includes(tab.type)">
                  <span class="label">Habilidade</span>
                  <input v-model="item.ability" class="input" :readonly="tabReadonly(tab)" placeholder="Opcional">
                </label>
                <label v-if="tab.allowBonuses">
                  <span class="label">Bonus / aumento</span>
                  <input v-model="item.bonus" class="input" :readonly="tabReadonly(tab)" placeholder="+1 Potencia">
                </label>
                <label v-if="tab.type === 'ITEMS'">
                  <span class="label">Quantidade</span>
                  <input v-model.number="item.quantity" type="number" class="input" :readonly="tabReadonly(tab)">
                </label>
                <label class="md:col-span-4">
                  <span class="label">Texto / descricao</span>
                  <textarea v-model="item.description" rows="3" class="input" :readonly="tabReadonly(tab)" />
                </label>
              </div>

              <div v-if="tab.type === 'CUSTOM' && tab.fields?.length" class="mt-3 grid gap-3 md:grid-cols-2">
                <label v-for="field in tab.fields" :key="field.id || field.key" :class="field.type === 'LONG_TEXT' ? 'md:col-span-2' : ''">
                  <span class="label">{{ field.label }}</span>
                  <textarea v-if="field.type === 'LONG_TEXT'" :value="String(item.fields[field.key] || '')" rows="3" class="input" :readonly="tabReadonly(tab)" @input="item.fields[field.key] = ($event.target as HTMLTextAreaElement).value" />
                  <input v-else-if="field.type === 'NUMBER'" :value="item.fields[field.key] as string | number" type="number" class="input" :readonly="tabReadonly(tab)" @input="item.fields[field.key] = Number(($event.target as HTMLInputElement).value)">
                  <select v-else-if="field.type === 'SELECT'" v-model="item.fields[field.key]" class="select" :disabled="tabReadonly(tab)">
                    <option v-for="option in field.options || []" :key="option" :value="option">{{ option }}</option>
                  </select>
                  <input v-else :value="String(item.fields[field.key] || '')" class="input" :readonly="tabReadonly(tab)" @input="item.fields[field.key] = ($event.target as HTMLInputElement).value">
                </label>
              </div>
            </div>

            <button v-if="!tabReadonly(tab)" type="button" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-bold text-white hover:border-ember/40" @click="addTabItem(tab)">
              <Plus class="h-4 w-4" />{{ addButtonLabel(tab) }}
            </button>
            <p v-if="!tabItems(tab).length" class="rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">Nenhum registro nesta aba.</p>
          </div>
        </div>
      </AppCard>

      <AppCard v-for="group in groups" :key="group.category">
        <button type="button" class="flex w-full items-center justify-between gap-3 text-left" @click="toggleGroup(group.category)">
          <h2 class="text-lg font-black text-white">{{ categoryLabel(group.category) }}</h2>
          <ChevronDown class="h-5 w-5 text-ember transition" :class="isGroupOpen(group.category) ? 'rotate-180' : ''" />
        </button>
        <div v-if="isGroupOpen(group.category)" class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="field in group.fields" :key="field.key" class="space-y-2" :class="field.type === 'TEXT' ? 'md:col-span-2 xl:col-span-3' : ''">
            <div class="flex justify-end">
              <AppActionMenu title="Detalhes do campo" :items="sourceItems()" trigger-class="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-mist hover:text-white" @select="handleFieldAction(field, $event)" />
            </div>
            <DynamicFieldRenderer v-model="draft[field.key]" :field="field" :readonly="!editable" />
          </div>
        </div>
      </AppCard>

      <AppCard v-for="section in builtInSections" :key="section.key">
        <button type="button" class="flex w-full items-center justify-between gap-3 text-left" @click="toggleGroup(`builtin:${section.key}`)">
          <h2 class="text-lg font-black text-white">{{ section.title }}</h2>
          <ChevronDown class="h-5 w-5 text-ember transition" :class="isGroupOpen(`builtin:${section.key}`) ? 'rotate-180' : ''" />
        </button>
        <div v-if="isGroupOpen(`builtin:${section.key}`)" class="mt-4">
          <div v-if="section.multiple" class="space-y-3">
            <div
              v-for="(item, index) in listItems(section.key)"
              :key="item.id || index"
              class="rounded-lg border border-white/10 bg-white/[0.04] p-3"
            >
              <div class="grid gap-3 md:grid-cols-[1fr_160px_160px_auto]">
                <label>
                  <span class="label">Nome</span>
                  <input v-model="item.name" class="input" :readonly="!editable" placeholder="Nome">
                </label>
                <label v-if="section.damage">
                  <span class="label">Dano</span>
                  <input v-model="item.damage" class="input" :readonly="!editable" placeholder="1d8">
                </label>
                <label v-if="section.skill">
                  <span class="label">Habilidade</span>
                  <input v-model="item.skill" class="input" :readonly="!editable" placeholder="Opcional">
                </label>
                <AppActionMenu v-if="editable" class="self-end" :items="[{ key: 'delete', label: 'Remover', icon: Trash2, danger: true }]" title="Acoes do registro" @select="$event === 'delete' && removeListItem(section.key, index)" />
                <label class="md:col-span-4">
                  <span class="label">Texto / descricao</span>
                  <textarea v-model="item.description" rows="3" class="input" :readonly="!editable" />
                </label>
              </div>
            </div>
            <button v-if="editable" type="button" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-bold text-white hover:border-ember/40" @click="addListItem(section.key)">
              <Plus class="h-4 w-4" />Adicionar
            </button>
            <p v-if="!listItems(section.key).length" class="rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">Nada cadastrado nesta secao.</p>
          </div>

          <div v-else class="grid gap-3">
            <label>
              <span class="label">Nome</span>
              <input v-model="singleBlock(section.key).name" class="input" :readonly="!editable" placeholder="Titulo opcional">
            </label>
            <label>
              <span class="label">Texto / descricao</span>
              <textarea v-model="singleBlock(section.key).description" rows="5" class="input" :readonly="!editable" />
            </label>
          </div>
        </div>
      </AppCard>

      <AppCard v-for="list in sheetLists" :key="list.id || list.key">
        <button type="button" class="flex w-full items-center justify-between gap-3 text-left" @click="toggleGroup(`custom:${list.key}`)">
          <span>
            <h2 class="text-lg font-black text-white">{{ list.name }}</h2>
            <p v-if="list.description" class="mt-1 text-sm text-mist">{{ list.description }}</p>
          </span>
          <ChevronDown class="h-5 w-5 text-ember transition" :class="isGroupOpen(`custom:${list.key}`) ? 'rotate-180' : ''" />
        </button>
        <div v-if="isGroupOpen(`custom:${list.key}`)" class="mt-4 space-y-3">
          <div
            v-for="(item, index) in listItems(list.key)"
            :key="item.id || index"
            class="rounded-lg border border-white/10 bg-white/[0.04] p-3"
          >
            <div class="grid gap-3 md:grid-cols-[1fr_150px_150px_auto]">
              <label>
                <span class="label">Nome</span>
                <input v-model="item.name" class="input" :readonly="!editable" placeholder="Katana, bola de fogo...">
              </label>
              <label v-if="list.allowDamage">
                <span class="label">Dano fixo</span>
                <input v-model="item.damage" class="input" :readonly="!editable" placeholder="1d8">
              </label>
              <label v-if="list.allowSkill">
                <span class="label">Habilidade</span>
                <input v-model="item.skill" class="input" :readonly="!editable" placeholder="Opcional">
              </label>
              <AppActionMenu v-if="editable" class="self-end" :items="[{ key: 'delete', label: 'Remover item', icon: Trash2, danger: true }]" title="Acoes do item" @select="$event === 'delete' && removeListItem(list.key, index)" />
              <label class="md:col-span-4">
                <span class="label">Descricao longa</span>
                <textarea v-model="item.description" rows="4" class="input" :readonly="!editable" />
              </label>
            </div>
            <div v-if="list.allowExtras" class="mt-3 space-y-2">
              <div v-for="(extra, extraIndex) in item.extras || []" :key="extra.id || extraIndex" class="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                <input v-model="extra.name" class="input" :readonly="!editable" placeholder="Campo extra">
                <input v-model="extra.value" class="input" :readonly="!editable" placeholder="Valor ou texto">
                <AppActionMenu v-if="editable" :items="[{ key: 'delete', label: 'Remover campo', icon: Trash2, danger: true }]" title="Acoes do campo" @select="$event === 'delete' && removeExtra(item, extraIndex)" />
              </div>
              <button v-if="editable" type="button" class="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-bold text-white hover:border-ember/40" @click="addExtra(item)">
                <Plus class="h-4 w-4" />Campo extra
              </button>
            </div>
          </div>
          <button v-if="editable" type="button" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-bold text-white hover:border-ember/40" @click="addListItem(list.key)">
            <Plus class="h-4 w-4" />Adicionar {{ list.name }}
          </button>
          <p v-if="!listItems(list.key).length" class="rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">Nenhum item nesta lista.</p>
        </div>
      </AppCard>

      <AppCard v-if="rulesMarkdown">
        <button type="button" class="flex w-full items-center justify-between gap-3 text-left" @click="toggleGroup('rulesMarkdown')">
          <h2 class="text-lg font-black text-white">Regras gerais</h2>
          <ChevronDown class="h-5 w-5 text-ember transition" :class="isGroupOpen('rulesMarkdown') ? 'rotate-180' : ''" />
        </button>
        <div v-if="isGroupOpen('rulesMarkdown')" class="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-mist">
          <div class="markdown-preview" v-html="renderMarkdown(rulesMarkdown)" />
        </div>
      </AppCard>
    </div>

    <Teleport to="body">
      <div v-if="sourceField" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" @click.self="sourceField = null">
        <div class="w-full max-w-md rounded-xl border border-white/10 bg-panel p-5 shadow-soft">
          <h2 class="text-xl font-black text-white">Origem de {{ sourceField.label }}</h2>
          <p class="mt-1 text-sm text-mist">Valor atual: {{ draft[sourceField.key] ?? '-' }}</p>
          <div class="mt-4 space-y-2">
            <div v-for="source in selectedFieldSources" :key="`${source.label}-${source.value}`" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div class="flex items-center justify-between gap-3">
                <span class="font-black text-white">{{ source.label }}</span>
                <span class="text-sm font-black text-ember">{{ source.value }}</span>
              </div>
              <p v-if="source.note" class="mt-1 text-xs leading-5 text-mist">{{ source.note }}</p>
            </div>
          </div>
          <div class="mt-5 flex justify-end">
            <AppButton type="button" variant="ghost" @click="sourceField = null">Fechar</AppButton>
          </div>
        </div>
      </div>
    </Teleport>
    <SavePublishModal
      :open="saveIntentOpen"
      title="Salvar ficha"
      message="Salvar atualiza sua ficha pessoal. Salvar e postar cria um snapshot independente para analise da comunidade."
      :loading="saving || publishing"
      @close="saveIntentOpen = false"
      @save="save(false, false)"
      @publish="save(false, true)"
    />
  </div>
</template>

<style scoped>
.sheet-record-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 1rem;
}

.sheet-record-wide {
  grid-column: 1 / -1;
}

.sheet-field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: 0.75rem;
}

.sheet-field-wide {
  grid-column: 1 / -1;
}

.sheet-resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  gap: 0.75rem;
}

@media (max-width: 420px) {
  .sheet-record-grid,
  .sheet-field-grid,
  .sheet-resource-grid {
    grid-template-columns: 1fr;
  }
}

.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4) {
  margin: 0.75rem 0 0.35rem;
  color: white;
  font-weight: 900;
}

.markdown-preview :deep(code) {
  border: 1px solid rgb(255 255 255 / 0.1);
  border-radius: 0.35rem;
  background: rgb(255 255 255 / 0.06);
  padding: 0.05rem 0.3rem;
  color: var(--color-ember, #ff8a13);
}
</style>
