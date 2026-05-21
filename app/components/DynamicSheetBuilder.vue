<script setup lang="ts">
import { Copy, Eye, EyeOff, FileText, GripVertical, Plus, SlidersHorizontal, Trash2, X } from 'lucide-vue-next'
import type { DynamicField, SheetFieldType, SheetTab, SheetTabField, SheetTabRecord, SheetTabType, SystemClass, SystemClassLevel, SystemClassLevelChange, SystemSchema } from '../../shared/types/system'
import { createSheetTab, fieldsFromSheetTabs, keyFromLabel, normalizeSheetTabs, sheetFieldTypeLabels, sheetTabTypeLabels, uid } from '~~/shared/utils/sheetTabs'

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
const fieldTypes: SheetFieldType[] = ['SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'CHECKBOX', 'SELECT', 'LIST', 'DAMAGE', 'ROLL', 'COST', 'RANGE', 'BONUS', 'IMAGE', 'TAGS', 'EXTRA_PAIR']
const activeTabId = ref('')
const createOpen = ref(false)
const selectedType = ref<SheetTabType>('ATTRIBUTES')
const newTabName = ref('')

if (!schema.value.leveling) {
  schema.value.leveling = {
    levelOneAttributePoints: 6,
    attributesPerLevel: 1,
    levelOneAttributeLimit: 5,
    attributeLimitIncreasePerLevel: 1,
    maxAttributeLimit: 20
  }
}

schema.value.sheetTabs = normalizeSheetTabs(schema.value)
if (!schema.value.sheetTabs.length) schema.value.sheetTabs = []
fields.value = fieldsFromSheetTabs(schema.value.sheetTabs, fields.value)
activeTabId.value = schema.value.sheetTabs[0]?.id || ''

const activeTab = computed(() => tabs.value.find((tab) => tab.id === activeTabId.value) || tabs.value[0])
const enabledTabs = computed(() => tabs.value.filter((tab) => tab.enabled !== false))
const classes = computed(() => schema.value.classes || [])
const classTargets = computed(() => {
  const fromTabs = tabs.value
    .filter((tab) => ['ATTRIBUTES', 'RESOURCES', 'SKILLS'].includes(tab.type))
    .flatMap((tab) => (tab.records || []).map((record) => ({
      key: keyFromLabel(`${tab.key}_${record.name}`),
      label: record.name,
      category: tab.type === 'ATTRIBUTES' ? 'ATTRIBUTE' : tab.type === 'RESOURCES' ? 'RESOURCE' : 'SKILL'
    })))
  const fromFields = fields.value
    .filter((field) => field.type === 'NUMBER' && ['ATTRIBUTE', 'SKILL', 'RESOURCE', 'STATUS_BAR', 'NUMERIC_FIELD'].includes(field.category))
    .map((field) => ({ key: field.key, label: field.label, category: field.category }))
  const seen = new Set<string>()
  return [...fromTabs, ...fromFields].filter((field) => {
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

function addQuickTab(type: SheetTabType) {
  const next = createSheetTab(type, tabs.value.length)
  next.key = uniqueTabKey(next.key)
  tabs.value = [...tabs.value, next]
  activeTabId.value = next.id || ''
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
    { key: 'up', label: 'Mover para cima', icon: GripVertical, disabled: index <= 0 },
    { key: 'down', label: 'Mover para baixo', icon: GripVertical, disabled: index === tabs.value.length - 1 },
    { key: 'duplicate', label: 'Duplicar', icon: Copy },
    { key: 'toggle', label: tab.enabled === false ? 'Ativar na ficha' : 'Desativar na ficha', icon: tab.enabled === false ? Eye : EyeOff },
    { key: 'delete', label: 'Apagar aba', icon: Trash2, danger: true }
  ]
}

function handleAction(tab: SheetTab, action: string) {
  const index = tabs.value.findIndex((item) => item.id === tab.id)
  if (index < 0) return
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
  if (action === 'toggle') tab.enabled = tab.enabled === false
  if (action === 'delete') {
    const confirmed = window.confirm('Apagar esta aba remove a estrutura do sistema. Dados ja salvos em personagens ficam preservados no JSON, mas deixam de aparecer enquanto a aba nao existir. Continuar?')
    if (!confirmed) return
    const next = tabs.value.filter((item) => item.id !== tab.id)
    tabs.value = next
    activeTabId.value = next[Math.max(0, index - 1)]?.id || ''
  }
}

function addRecord(tab: SheetTab) {
  tab.records ||= []
  const nextIndex = tab.records.length + 1
  tab.records.push({
    id: uid('sheet_record'),
    name: recordName(tab, nextIndex),
    description: '',
    text: '',
    value: ['ATTRIBUTES', 'RESOURCES', 'SKILLS'].includes(tab.type) ? 0 : '',
    min: null,
    max: null,
    damage: '',
    roll: '',
    cost: '',
    range: '',
    ability: '',
    bonus: '',
    effect: '',
    quantity: null,
    fields: {}
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
  return Array.from({ length: Math.max(1, Number(maxLevel || 1)) }, (_, index) => {
    const level = index + 1
    return previous.find((item) => item.level === level) || { level, changes: [] }
  })
}

function resizeClassLevels(rpgClass: SystemClass) {
  rpgClass.maxLevel = Math.max(1, Math.min(100, Number(rpgClass.maxLevel || 1)))
  rpgClass.levels = createLevels(rpgClass.maxLevel, rpgClass.levels)
}

function addLevelChange(level: SystemClassLevel) {
  const target = classTargets.value[0]
  if (!target) return
  level.changes.push({ targetKey: target.key, targetLabel: target.label, operation: 'ADD', value: 1, note: '' })
}

function addLevelText(level: SystemClassLevel) {
  level.changes.push({ operation: 'NOTE', note: 'Novo texto de classe para mostrar na ficha.' })
}

function levelActionItems() {
  return [
    { key: 'text', label: 'Texto', icon: FileText },
    { key: 'change', label: 'Alteracao', icon: SlidersHorizontal, disabled: classTargets.value.length === 0 }
  ]
}

function handleLevelAction(level: SystemClassLevel, action: string) {
  if (action === 'text') addLevelText(level)
  if (action === 'change') addLevelChange(level)
}

function removeLevelChange(level: SystemClassLevel, index: number) {
  level.changes.splice(index, 1)
}

function syncTargetLabel(change: SystemClassLevelChange) {
  if (!change.targetKey) return
  const target = classTargets.value.find((field) => field.key === change.targetKey)
  change.targetLabel = target?.label || change.targetKey
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

      <div class="mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          v-for="type in tabTypes"
          :key="type"
          type="button"
          class="whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-mist transition hover:border-ember/40 hover:text-white"
          @click="addQuickTab(type)"
        >
          + {{ sheetTabTypeLabels[type] }}
        </button>
      </div>
    </AppCard>

    <div class="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <AppCard>
        <div class="flex items-center justify-between gap-3">
          <h3 class="font-black text-white">Abas da ficha</h3>
          <span class="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-mist">{{ tabs.length }}</span>
        </div>

        <EmptyState
          v-if="!tabs.length"
          class="mt-4"
          :icon="FileText"
          title="Nenhuma aba criada"
          description="Comece vazio e adicione apenas o que a ficha deste sistema realmente usa."
        >
          <AppButton type="button" @click="openCreate()">Criar aba</AppButton>
        </EmptyState>

        <div v-else class="mt-4 space-y-2">
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
            <span class="shrink-0 text-xs font-bold" :class="tab.enabled === false ? 'text-mist' : 'text-ember'">{{ tab.enabled === false ? 'off' : 'on' }}</span>
          </button>
        </div>
      </AppCard>

      <div class="space-y-5">
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
            <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="activeTab.enabled" type="checkbox" class="accent-[var(--user-accent)]">Aparece na ficha</label>
            <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="activeTab.readonly" type="checkbox" class="accent-[var(--user-accent)]">Somente leitura</label>
            <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="activeTab.playerEditable" :disabled="activeTab.readonly" type="checkbox" class="accent-[var(--user-accent)]">Jogador edita</label>
            <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="activeTab.allowMultiple" type="checkbox" class="accent-[var(--user-accent)]">Multiplos registros</label>
            <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="activeTab.allowExtraFields" type="checkbox" class="accent-[var(--user-accent)]">Campos extras</label>
            <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="activeTab.allowRolls" type="checkbox" class="accent-[var(--user-accent)]">Rolagens</label>
            <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="activeTab.allowBonuses" type="checkbox" class="accent-[var(--user-accent)]">Bonus/aumentos</label>
            <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="activeTab.allowDamageCostAbility" type="checkbox" class="accent-[var(--user-accent)]">Dano/custo/habilidade</label>
          </div>

          <details class="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <summary class="cursor-pointer text-sm font-black text-white">Configuracoes avancadas</summary>
            <label class="mt-3 block">
              <span class="label">Chave interna gerada</span>
              <input v-model="activeTab.key" class="input" @blur="activeTab.key = uniqueTabKey(activeTab.key, activeTab.id)">
            </label>
          </details>
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
              <p class="muted mt-1">Reaproveita a logica de bonus por nivel ja usada pela ficha.</p>
            </div>
            <AppButton type="button" :disabled="classTargets.length === 0" @click="addClass"><Plus class="h-4 w-4" />Adicionar classe</AppButton>
          </div>

          <p v-if="classTargets.length === 0" class="mt-4 rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">Crie atributos, recursos ou pericias antes de configurar bonus por nivel.</p>

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
                <button type="button" class="self-end rounded-lg border border-flare/30 p-3 text-flare hover:bg-flare/10" title="Remover classe" @click="removeClass(classIndex)">
                  <Trash2 class="h-4 w-4" />
                </button>
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
                  <div class="mt-3 space-y-2">
                    <div v-for="(change, changeIndex) in level.changes" :key="changeIndex" class="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2" :class="change.operation === 'NOTE' ? 'lg:grid-cols-[1fr_auto]' : 'lg:grid-cols-[1fr_110px_110px_1fr_auto]'">
                      <label v-if="change.operation === 'NOTE'"><span class="label">Texto na ficha</span><textarea v-model="change.note" rows="2" class="input" /></label>
                      <label v-else><span class="label">Alvo</span><select v-model="change.targetKey" class="select" @change="syncTargetLabel(change)"><option v-for="target in classTargets" :key="target.key" :value="target.key">{{ target.label }}</option></select></label>
                      <label v-if="change.operation !== 'NOTE'"><span class="label">Regra</span><select v-model="change.operation" class="select"><option value="ADD">Somar</option><option value="SET">Definir</option><option value="NOTE">Texto</option></select></label>
                      <label v-if="change.operation !== 'NOTE'"><span class="label">Valor</span><input v-model.number="change.value" type="number" class="input"></label>
                      <label v-if="change.operation !== 'NOTE'"><span class="label">Nota</span><input v-model="change.note" class="input"></label>
                      <button type="button" class="self-end rounded-lg border border-flare/30 p-3 text-flare hover:bg-flare/10" title="Remover alteracao" @click="removeLevelChange(level, changeIndex)"><Trash2 class="h-4 w-4" /></button>
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
                <button type="button" class="self-end rounded-lg border border-flare/30 p-3 text-flare hover:bg-flare/10" title="Remover campo" @click="removeCustomField(activeTab, fieldIndex)"><Trash2 class="h-4 w-4" /></button>
                <label v-if="field.type === 'SELECT'" class="md:col-span-3"><span class="label">Opcoes separadas por virgula</span><input :value="field.options?.join(', ')" class="input" @input="field.options = ($event.target as HTMLInputElement).value.split(',').map((item) => item.trim()).filter(Boolean)"></label>
              </div>
            </div>
          </div>

          <div class="mt-5 space-y-3">
            <div v-for="(record, recordIndex) in activeTab.records || []" :key="record.id || recordIndex" class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div class="grid gap-3 md:grid-cols-[1fr_auto]">
                <label>
                  <span class="label">Nome</span>
                  <input v-model="record.name" class="input" placeholder="Nome do registro">
                </label>
                <button type="button" class="self-end rounded-lg border border-flare/30 p-3 text-flare hover:bg-flare/10" title="Remover registro" @click="removeRecord(activeTab, recordIndex)">
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>

              <div class="mt-3 grid gap-3 md:grid-cols-2">
                <label v-if="['ATTRIBUTES', 'RESOURCES', 'SKILLS'].includes(activeTab.type)">
                  <span class="label">Valor padrao</span>
                  <input v-model="record.value" type="number" class="input">
                </label>
                <label v-if="activeTab.type === 'ATTRIBUTES'">
                  <span class="label">Limite minimo</span>
                  <input v-model.number="record.min" type="number" class="input" placeholder="Opcional">
                </label>
                <label v-if="['ATTRIBUTES', 'RESOURCES'].includes(activeTab.type)">
                  <span class="label">{{ activeTab.type === 'RESOURCES' ? 'Valor maximo' : 'Limite maximo' }}</span>
                  <input v-model.number="record.max" type="number" class="input" placeholder="Opcional">
                </label>
                <label v-if="activeTab.type === 'SKILLS'">
                  <span class="label">Atributo relacionado</span>
                  <input v-model="record.relatedAttribute" class="input" placeholder="Opcional">
                </label>
                <label v-if="activeTab.allowDamageCostAbility">
                  <span class="label">Dano</span>
                  <input v-model="record.damage" class="input" placeholder="1d8">
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
                  <input v-model="record.ability" class="input" placeholder="Opcional">
                </label>
                <label v-if="activeTab.allowRolls">
                  <span class="label">Rolagem</span>
                  <input v-model="record.roll" class="input" placeholder="1d20 + atributo">
                </label>
                <label v-if="activeTab.allowBonuses">
                  <span class="label">Bonus / aumento</span>
                  <input v-model="record.bonus" class="input" placeholder="+1 Potencia">
                </label>
                <label v-if="activeTab.type === 'ITEMS'">
                  <span class="label">Quantidade padrao</span>
                  <input v-model.number="record.quantity" type="number" class="input" placeholder="Opcional">
                </label>
                <label class="md:col-span-2">
                  <span class="label">Texto / descricao</span>
                  <textarea v-model="record.description" rows="3" class="input" />
                </label>
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
          <div v-if="enabledTabs.length" class="mt-4 grid gap-3 md:grid-cols-2">
            <div v-for="tab in enabledTabs" :key="tab.id || tab.key" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-black text-white">{{ tab.name }}</p>
                  <p class="mt-1 text-xs text-mist">{{ sheetTabTypeLabels[tab.type] }} | {{ tab.readonly ? 'Leitura' : tab.playerEditable === false ? 'Bloqueada' : 'Editavel' }}</p>
                </div>
                <span class="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-mist">{{ tab.records?.length || (tab.type === 'RULES' ? 1 : 0) }}</span>
              </div>
              <p v-if="tab.description" class="mt-2 text-sm leading-6 text-mist">{{ tab.description }}</p>
            </div>
          </div>
          <p v-else class="mt-4 rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">A ficha ainda nao exibira abas opcionais.</p>
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
  </div>
</template>
