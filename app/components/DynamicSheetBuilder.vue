<script setup lang="ts">
import { FileText, Plus, SlidersHorizontal, Trash2 } from 'lucide-vue-next'
import type { DynamicField, FieldCategory, FieldType, SystemClass, SystemClassLevel, SystemClassLevelChange, SystemSchema } from '../../shared/types/system'

const fields = defineModel<DynamicField[]>('fields', { required: true })
const schema = defineModel<SystemSchema>('schema', { required: true })

const builtInSectionDefinitions = [
  { key: 'items', title: 'Itens', multiple: true, longText: false, allowDamage: false, allowSkill: false, allowExtras: false },
  { key: 'weapons', title: 'Armas', multiple: true, longText: false, allowDamage: true, allowSkill: true, allowExtras: false },
  { key: 'traits', title: 'Tracos / Talentos', multiple: true, longText: false, allowDamage: false, allowSkill: false, allowExtras: false },
  { key: 'powers', title: 'Poderes', multiple: true, longText: false, allowDamage: true, allowSkill: false, allowExtras: false },
  { key: 'biography', title: 'Biografia', multiple: false, longText: true, allowDamage: false, allowSkill: false, allowExtras: false },
  { key: 'appearance', title: 'Aparencia', multiple: false, longText: true, allowDamage: false, allowSkill: false, allowExtras: false },
  { key: 'personality', title: 'Alinhamento / Personalidade', multiple: false, longText: true, allowDamage: false, allowSkill: false, allowExtras: false },
  { key: 'conditions', title: 'Condicoes', multiple: true, longText: false, allowDamage: false, allowSkill: false, allowExtras: false }
]

const specialListDefinitions = [
  { key: 'equipment', name: 'Lista de equipamentos', description: 'Equipamentos, ferramentas, armaduras e itens carregados pelo personagem.', enabled: true, allowDamage: true, allowSkill: false, allowExtras: true },
  { key: 'spells', name: 'Lista de magias', description: 'Magias, tecnicas ou efeitos sobrenaturais com custo, alcance e campos extras.', enabled: true, allowDamage: true, allowSkill: true, allowExtras: true }
]

const sectionSteps = builtInSectionDefinitions.map((section) => section.title)
const steps = ['Informacoes', 'Regras de nivel', 'Atributos', 'Recursos', 'Pericias', 'Classes', ...sectionSteps, 'Regras gerais', 'Lista de equipamentos', 'Lista de magias', 'Lista personalizada', 'Rolagens', 'Preview', 'Publicar']
const current = ref(0)

const categories: Record<string, FieldCategory> = {
  Atributos: 'ATTRIBUTE',
  Recursos: 'RESOURCE',
  Pericias: 'SKILL',
  Rolagens: 'ROLL_RULE'
}

const currentStep = computed(() => steps[current.value] || 'Informacoes')
const currentCategory = computed(() => categories[currentStep.value])
const currentBuiltInDefinition = computed(() => builtInSectionDefinitions.find((section) => section.title === currentStep.value))
const currentBuiltInSection = computed(() => currentBuiltInDefinition.value ? schema.value.sheetSections?.find((section) => section.key === currentBuiltInDefinition.value?.key) : undefined)
const classTargets = computed(() => fields.value.filter((field) => field.type === 'NUMBER' && ['ATTRIBUTE', 'SKILL', 'RESOURCE', 'STATUS_BAR', 'NUMERIC_FIELD'].includes(field.category)))
const classes = computed(() => schema.value.classes || [])

if (!schema.value.leveling) {
  schema.value.leveling = {
    levelOneAttributePoints: 6,
    attributesPerLevel: 1,
    levelOneAttributeLimit: 5,
    attributeLimitIncreasePerLevel: 1,
    maxAttributeLimit: 20
  }
}

if (!schema.value.sheetTexts) {
  schema.value.sheetTexts = []
}

if (!schema.value.sheetLists) {
  schema.value.sheetLists = []
}

if (!schema.value.sheetSections) {
  schema.value.sheetSections = []
}

if (!schema.value.rulesMarkdown) {
  schema.value.rulesMarkdown = ''
}

ensureDefaultSections()
ensureSpecialLists()

function keyFromLabel(label: string) {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '')
}

function addField(category: FieldCategory) {
  const label = category === 'ATTRIBUTE' ? 'Novo atributo' : category === 'RESOURCE' ? 'Novo recurso' : category === 'SKILL' ? 'Nova pericia' : 'Novo campo'
  const type: FieldType = category === 'TEXT_FIELD' ? 'TEXT' : category === 'LIST_FIELD' ? 'LIST' : category === 'ROLL_RULE' ? 'DICE' : 'NUMBER'
  const nextIndex = fields.value.length + 1
  fields.value.push({
    key: `${keyFromLabel(label)}_${nextIndex}`,
    label,
    type,
    category,
    defaultValue: category === 'ATTRIBUTE' ? 0 : type === 'NUMBER' ? 0 : '',
    optionsJson: type === 'LIST' ? ['Opcao A', 'Opcao B'] : undefined,
    order: nextIndex
  })
}

function removeField(index: number) {
  fields.value.splice(index, 1)
}

function addSheetText() {
  schema.value.sheetTexts ||= []
  const nextIndex = schema.value.sheetTexts.length + 1
  schema.value.sheetTexts.push({
    id: `sheet_text_${Date.now()}_${nextIndex}`,
    name: `Texto ${nextIndex}`,
    text: ''
  })
}

function removeSheetText(index: number) {
  schema.value.sheetTexts?.splice(index, 1)
}

function addSheetList() {
  schema.value.sheetLists ||= []
  const nextIndex = schema.value.sheetLists.length + 1
  schema.value.sheetLists.push({
    id: `sheet_list_${Date.now()}_${nextIndex}`,
    key: `lista_${nextIndex}`,
    name: `Lista ${nextIndex}`,
    description: '',
    allowDamage: true,
    allowSkill: false,
    allowExtras: true,
    enabled: true
  })
}

function removeSheetList(index: number) {
  schema.value.sheetLists?.splice(index, 1)
}

function ensureDefaultSections() {
  schema.value.sheetSections ||= []
  for (const definition of builtInSectionDefinitions) {
    const existing = schema.value.sheetSections.find((section) => section.key === definition.key)
    if (existing) {
      existing.title ||= definition.title
      existing.multiple = definition.multiple
      existing.longText = definition.longText
      existing.allowDamage = definition.allowDamage
      existing.allowSkill = definition.allowSkill
      existing.allowExtras = definition.allowExtras
      existing.enabled = existing.enabled !== false
    } else {
      schema.value.sheetSections.push({ id: `section_${definition.key}`, enabled: true, ...definition })
    }
  }
}

function ensureSpecialLists() {
  schema.value.sheetLists ||= []
  for (const definition of specialListDefinitions) {
    const existing = schema.value.sheetLists.find((list) => list.key === definition.key)
    if (existing) {
      existing.enabled = existing.enabled !== false
      existing.allowDamage = existing.allowDamage ?? definition.allowDamage
      existing.allowSkill = existing.allowSkill ?? definition.allowSkill
      existing.allowExtras = existing.allowExtras ?? definition.allowExtras
    } else {
      schema.value.sheetLists.push({ id: `sheet_list_${definition.key}`, ...definition })
    }
  }
}

function sheetListByKey(key: string) {
  ensureSpecialLists()
  return schema.value.sheetLists?.find((list) => list.key === key)
}

function customSheetLists() {
  ensureSpecialLists()
  return schema.value.sheetLists?.filter((list) => !specialListDefinitions.some((definition) => definition.key === list.key)) || []
}

function addCustomSheetList() {
  schema.value.sheetLists ||= []
  const nextIndex = customSheetLists().length + 1
  schema.value.sheetLists.push({
    id: `sheet_list_custom_${Date.now()}_${nextIndex}`,
    key: `lista_personalizada_${nextIndex}`,
    name: `Lista personalizada ${nextIndex}`,
    description: '',
    enabled: true,
    allowDamage: false,
    allowSkill: false,
    allowExtras: true
  })
}

function filtered(category: FieldCategory) {
  return fields.value
    .map((field, index) => ({ field, index }))
    .filter((item) => item.field.category === category)
}

function ensureClasses() {
  if (!schema.value.classes) schema.value.classes = []
  return schema.value.classes
}

function addClass() {
  const nextIndex = ensureClasses().length + 1
  const nextClass: SystemClass = {
    id: `class_${Date.now()}_${nextIndex}`,
    key: `classe_${nextIndex}`,
    name: `Classe ${nextIndex}`,
    description: '',
    maxLevel: 5,
    levels: createLevels(5)
  }
  schema.value.classes?.push(nextClass)
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
  level.changes.push({
    targetKey: target.key,
    targetLabel: target.label,
    operation: 'ADD',
    value: 1,
    note: ''
  })
}

function addLevelText(level: SystemClassLevel) {
  level.changes.push({
    operation: 'NOTE',
    note: 'Novo texto de classe para mostrar na ficha.'
  })
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

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    ATTRIBUTE: 'Atributo',
    RESOURCE: 'Recurso',
    SKILL: 'Pericia',
    TEXT_FIELD: 'Informacao',
    NUMERIC_FIELD: 'Numero',
    BOOLEAN_FIELD: 'Sim/Nao',
    LIST_FIELD: 'Lista',
    FORMULA: 'Formula',
    ROLL_RULE: 'Regra de rolagem',
    STATUS_BAR: 'Barra de estado'
  }
  return labels[category] || category
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="(step, index) in steps"
        :key="step"
        type="button"
        class="whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-bold transition"
        :class="current === index ? 'border-ember bg-ember/15 text-ember' : 'border-white/10 bg-white/[0.04] text-mist hover:text-white'"
        @click="current = index"
      >
        {{ index + 1 }}. {{ step }}
      </button>
    </div>

    <AppCard v-if="current === 0">
      <h2 class="text-xl font-black text-white">Estrutura basica da ficha</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <label>
          <span class="label">Recurso principal</span>
          <input v-model="schema.primaryResource" class="input" placeholder="vida">
        </label>
        <label>
          <span class="label">Rolagem padrao</span>
          <input v-model="schema.defaultRoll" class="input" placeholder="1d20 + atributo">
        </label>
        <label class="md:col-span-2">
          <span class="label">Notas internas do sistema</span>
          <textarea v-model="schema.notes" rows="4" class="input" placeholder="Descreva regras, categorias e convencoes." />
        </label>
      </div>
    </AppCard>

    <AppCard v-else-if="currentStep === 'Regras de nivel'">
      <h2 class="text-xl font-black text-white">Regras de atributos por nivel</h2>
      <p class="muted mt-1">Essas regras travam a criacao do personagem para a ficha nascer balanceada.</p>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <label>
          <span class="label">Pontos de atributo no nivel 1</span>
          <input v-model.number="schema.leveling!.levelOneAttributePoints" type="number" min="0" max="200" class="input">
        </label>
        <label>
          <span class="label">Atributos ganhos por nivel</span>
          <input v-model.number="schema.leveling!.attributesPerLevel" type="number" min="0" max="100" class="input">
        </label>
        <label>
          <span class="label">Limite do atributo no nivel 1</span>
          <input v-model.number="schema.leveling!.levelOneAttributeLimit" type="number" min="1" max="100" class="input">
        </label>
        <label>
          <span class="label">Aumento do limite por nivel</span>
          <input v-model.number="schema.leveling!.attributeLimitIncreasePerLevel" type="number" min="0" max="100" class="input">
        </label>
        <label>
          <span class="label">Limite maximo do atributo</span>
          <input v-model.number="schema.leveling!.maxAttributeLimit" type="number" min="1" max="200" class="input">
        </label>
      </div>
    </AppCard>

    <AppCard v-else-if="currentCategory">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-black text-white">{{ steps[current] }}</h2>
          <p class="muted">Campos flexiveis salvos no banco e renderizados dinamicamente na ficha.</p>
        </div>
        <AppButton type="button" @click="addField(currentCategory)"><Plus class="h-4 w-4" />Adicionar</AppButton>
      </div>

      <div class="mt-5 space-y-3">
        <div
          v-for="{ field, index } in filtered(currentCategory)"
          :key="field.id || index"
          class="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_150px_150px_auto]"
        >
          <label>
            <span class="label">Nome</span>
            <input v-model="field.label" class="input" @blur="field.key = field.key || keyFromLabel(field.label)">
          </label>
          <label>
            <span class="label">Chave</span>
            <input v-model="field.key" class="input">
          </label>
          <label>
            <span class="label">Tipo</span>
            <select v-model="field.type" class="select">
              <option value="NUMBER">Numero</option>
              <option value="TEXT">Texto</option>
              <option value="BOOLEAN">Booleano</option>
              <option value="LIST">Lista</option>
              <option value="FORMULA">Formula</option>
              <option value="DICE">Dado</option>
            </select>
          </label>
          <label>
            <span class="label">Padrao</span>
            <input v-model="field.defaultValue" class="input">
          </label>
          <button type="button" class="self-end rounded-lg border border-flare/30 p-3 text-flare hover:bg-flare/10" title="Remover campo" @click="removeField(index)">
            <Trash2 class="h-4 w-4" />
          </button>
          <label v-if="field.type === 'LIST'" class="md:col-span-2 xl:col-span-5">
            <span class="label">Opcoes separadas por virgula</span>
            <input :value="Array.isArray(field.optionsJson) ? field.optionsJson.join(', ') : field.optionsJson" class="input" @input="field.optionsJson = ($event.target as HTMLInputElement).value.split(',').map((item) => item.trim()).filter(Boolean)">
          </label>
          <label v-if="field.type === 'FORMULA' || field.category === 'ROLL_RULE'" class="md:col-span-2 xl:col-span-5">
            <span class="label">Formula ou regra</span>
            <input v-model="field.formula" class="input" placeholder="Defesa = 10 + agilidade">
          </label>
        </div>
        <div v-if="filtered(currentCategory).length === 0" class="rounded-lg border border-dashed border-white/15 p-8 text-center text-mist">
          Nenhum campo aqui ainda.
        </div>
      </div>
    </AppCard>

    <AppCard v-else-if="currentBuiltInSection">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-xl font-black text-white">{{ currentBuiltInSection.title }}</h2>
          <p class="muted mt-1">Esta aba define se essa secao existe na ficha e quais campos o jogador podera preencher.</p>
        </div>
        <label class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white">
          <input v-model="currentBuiltInSection.enabled" type="checkbox" class="accent-[var(--user-accent)]">
          Usar na ficha
        </label>
      </div>

      <div class="mt-5 grid gap-4 md:grid-cols-2">
        <label>
          <span class="label">Nome da aba na ficha</span>
          <input v-model="currentBuiltInSection.title" class="input">
        </label>
        <label>
          <span class="label">Chave interna</span>
          <input v-model="currentBuiltInSection.key" class="input" readonly>
        </label>
      </div>

      <div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <span class="soft-row p-3 text-sm text-mist">
          <b class="block text-white">Nome</b>
          Campo padrao sempre presente.
        </span>
        <span class="soft-row p-3 text-sm text-mist">
          <b class="block text-white">Texto / descricao</b>
          {{ currentBuiltInSection.longText ? 'Campo longo para texto de ficha.' : 'Campo de descricao.' }}
        </span>
        <label v-if="currentBuiltInSection.allowDamage" class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white">
          <input v-model="currentBuiltInSection.allowDamage" type="checkbox" class="accent-[var(--user-accent)]">
          Dano
        </label>
        <label v-if="currentBuiltInSection.allowSkill" class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white">
          <input v-model="currentBuiltInSection.allowSkill" type="checkbox" class="accent-[var(--user-accent)]">
          Habilidade opcional
        </label>
      </div>

      <div class="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-ember">Como ficara para o jogador</p>
        <p class="mt-2 text-sm leading-6 text-mist">
          {{ currentBuiltInSection.multiple ? 'O jogador podera adicionar varios registros nesta secao.' : 'O jogador preenchera um bloco unico desta secao.' }}
          A estrutura vem deste sistema; a ficha apenas salva os valores preenchidos pelo personagem.
        </p>
      </div>
    </AppCard>

    <AppCard v-else-if="currentStep === 'Regras gerais'">
      <h2 class="text-xl font-black text-white">Regras gerais</h2>
      <p class="muted mt-1">Texto do sistema para regras, combate, magia, dano e observacoes. Na ficha ele aparece como leitura, sem ser um campo pessoal do personagem.</p>
      <label class="mt-5 block">
        <span class="label">Markdown do sistema</span>
        <textarea v-model="schema.rulesMarkdown" rows="12" class="input" placeholder="# Combate&#10;Use este espaco para regras gerais do sistema." />
      </label>
    </AppCard>

    <AppCard v-else-if="currentStep === 'Lista de equipamentos' && sheetListByKey('equipment')">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-xl font-black text-white">Lista de equipamentos</h2>
          <p class="muted mt-1">Configure a lista de equipamentos que a ficha do personagem podera preencher.</p>
        </div>
        <label class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white">
          <input v-model="sheetListByKey('equipment')!.enabled" type="checkbox" class="accent-[var(--user-accent)]">
          Usar na ficha
        </label>
      </div>
      <div class="mt-5 grid gap-4 md:grid-cols-2">
        <label>
          <span class="label">Nome da lista</span>
          <input v-model="sheetListByKey('equipment')!.name" class="input">
        </label>
        <label>
          <span class="label">Chave interna</span>
          <input v-model="sheetListByKey('equipment')!.key" class="input" readonly>
        </label>
        <label class="md:col-span-2">
          <span class="label">Descricao</span>
          <textarea v-model="sheetListByKey('equipment')!.description" rows="3" class="input" />
        </label>
      </div>
      <div class="mt-3 grid gap-2 sm:grid-cols-3">
        <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="sheetListByKey('equipment')!.allowDamage" type="checkbox" class="accent-[var(--user-accent)]">Dano fixo</label>
        <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="sheetListByKey('equipment')!.allowSkill" type="checkbox" class="accent-[var(--user-accent)]">Habilidade</label>
        <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="sheetListByKey('equipment')!.allowExtras" type="checkbox" class="accent-[var(--user-accent)]">Campos extras com +</label>
      </div>
    </AppCard>

    <AppCard v-else-if="currentStep === 'Lista de magias' && sheetListByKey('spells')">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-xl font-black text-white">Lista de magias</h2>
          <p class="muted mt-1">Configure a lista de magias, tecnicas ou poderes especiais da ficha.</p>
        </div>
        <label class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white">
          <input v-model="sheetListByKey('spells')!.enabled" type="checkbox" class="accent-[var(--user-accent)]">
          Usar na ficha
        </label>
      </div>
      <div class="mt-5 grid gap-4 md:grid-cols-2">
        <label>
          <span class="label">Nome da lista</span>
          <input v-model="sheetListByKey('spells')!.name" class="input">
        </label>
        <label>
          <span class="label">Chave interna</span>
          <input v-model="sheetListByKey('spells')!.key" class="input" readonly>
        </label>
        <label class="md:col-span-2">
          <span class="label">Descricao</span>
          <textarea v-model="sheetListByKey('spells')!.description" rows="3" class="input" />
        </label>
      </div>
      <div class="mt-3 grid gap-2 sm:grid-cols-3">
        <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="sheetListByKey('spells')!.allowDamage" type="checkbox" class="accent-[var(--user-accent)]">Dano</label>
        <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="sheetListByKey('spells')!.allowSkill" type="checkbox" class="accent-[var(--user-accent)]">Custo / alcance / habilidade</label>
        <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="sheetListByKey('spells')!.allowExtras" type="checkbox" class="accent-[var(--user-accent)]">Campos extras com +</label>
      </div>
    </AppCard>

    <AppCard v-else-if="currentStep === 'Lista personalizada'">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-black text-white">Lista personalizada / Outro</h2>
          <p class="muted">Adicione listas proprias do sistema, sem prender a ficha a um RPG especifico.</p>
        </div>
        <AppButton type="button" @click="addCustomSheetList"><Plus class="h-4 w-4" />Adicionar lista</AppButton>
      </div>

      <div class="mt-5 space-y-3">
        <div v-for="(item, index) in customSheetLists()" :key="item.id || item.key" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div class="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label>
              <span class="label">Nome</span>
              <input v-model="item.name" class="input" placeholder="Lista de reputacoes" @blur="item.key = item.key || keyFromLabel(item.name)">
            </label>
            <label>
              <span class="label">Chave</span>
              <input v-model="item.key" class="input">
            </label>
            <button type="button" class="self-end rounded-lg border border-flare/30 p-3 text-flare hover:bg-flare/10" title="Remover lista" @click="removeSheetList((schema.sheetLists || []).findIndex((list) => list === item))">
              <Trash2 class="h-4 w-4" />
            </button>
            <label class="md:col-span-3">
              <span class="label">Descricao</span>
              <textarea v-model="item.description" rows="2" class="input" />
            </label>
          </div>
          <div class="mt-3 grid gap-2 sm:grid-cols-3">
            <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="item.enabled" type="checkbox" class="accent-[var(--user-accent)]">Usar na ficha</label>
            <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="item.allowDamage" type="checkbox" class="accent-[var(--user-accent)]">Dano</label>
            <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="item.allowSkill" type="checkbox" class="accent-[var(--user-accent)]">Habilidade</label>
            <label class="soft-row flex items-center gap-2 p-3 text-sm font-bold text-white"><input v-model="item.allowExtras" type="checkbox" class="accent-[var(--user-accent)]">Campos extras com +</label>
          </div>
        </div>
        <div v-if="!customSheetLists().length" class="rounded-lg border border-dashed border-white/15 p-8 text-center text-mist">
          Nenhuma lista personalizada ainda.
        </div>
      </div>
    </AppCard>

    <AppCard v-else-if="currentStep === 'Classes'">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-black text-white">Classes e progresso por nivel</h2>
          <p class="muted">Defina bonus automaticos e textos de classe que aparecem na ficha do personagem.</p>
        </div>
        <AppButton type="button" :disabled="classTargets.length === 0" @click="addClass"><Plus class="h-4 w-4" />Adicionar classe</AppButton>
      </div>

      <div v-if="classTargets.length === 0" class="mt-5 rounded-lg border border-dashed border-white/15 p-8 text-center text-mist">
        Crie atributos, pericias ou recursos antes de montar classes.
      </div>

      <div class="mt-5 space-y-4">
        <div v-for="(rpgClass, classIndex) in classes" :key="rpgClass.id || classIndex" class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div class="grid gap-3 lg:grid-cols-[1fr_1fr_140px_auto]">
            <label>
              <span class="label">Nome da classe</span>
              <input v-model="rpgClass.name" class="input" @blur="rpgClass.key = rpgClass.key || keyFromLabel(rpgClass.name)">
            </label>
            <label>
              <span class="label">Chave</span>
              <input v-model="rpgClass.key" class="input">
            </label>
            <label>
              <span class="label">Niveis</span>
              <input v-model.number="rpgClass.maxLevel" type="number" min="1" max="100" class="input" @change="resizeClassLevels(rpgClass)">
            </label>
            <button type="button" class="self-end rounded-lg border border-flare/30 p-3 text-flare hover:bg-flare/10" title="Remover classe" @click="removeClass(classIndex)">
              <Trash2 class="h-4 w-4" />
            </button>
            <label class="lg:col-span-4">
              <span class="label">Descricao</span>
              <textarea v-model="rpgClass.description" rows="2" class="input" placeholder="Papel da classe, estilo de jogo, restricoes..." />
            </label>
          </div>

          <div class="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
            <div v-for="level in rpgClass.levels" :key="level.level" class="rounded-lg border border-white/10 bg-panel/70 p-3">
              <div class="flex items-center justify-between gap-3">
                <h3 class="font-black text-white">Nivel {{ level.level }}</h3>
                <AppActionMenu
                  title="Adicionar ao nivel"
                  trigger-class="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-mist transition hover:border-ember/40 hover:text-ember"
                  :items="levelActionItems()"
                  @select="handleLevelAction(level, $event)"
                >
                  <Plus class="h-4 w-4" />
                </AppActionMenu>
              </div>

              <div class="mt-3 space-y-2">
                <div
                  v-for="(change, changeIndex) in level.changes"
                  :key="changeIndex"
                  class="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2"
                  :class="change.operation === 'NOTE' ? 'lg:grid-cols-[1fr_auto]' : 'lg:grid-cols-[1fr_110px_110px_1fr_auto]'"
                >
                  <label v-if="change.operation === 'NOTE'">
                    <span class="label">Texto que aparece na ficha</span>
                    <textarea v-model="change.note" rows="2" class="input" placeholder="No nivel 3, a classe Urso ganha pele grossa e recebe +3 de armadura." />
                  </label>
                  <label v-else>
                    <span class="label">Alvo</span>
                    <select v-model="change.targetKey" class="select" @change="syncTargetLabel(change)">
                      <option v-for="target in classTargets" :key="target.key" :value="target.key">{{ target.label }} ({{ target.category }})</option>
                    </select>
                  </label>
                  <label v-if="change.operation !== 'NOTE'">
                    <span class="label">Regra</span>
                    <select v-model="change.operation" class="select">
                      <option value="ADD">Somar</option>
                      <option value="SET">Definir</option>
                      <option value="NOTE">Texto</option>
                    </select>
                  </label>
                  <label v-if="change.operation !== 'NOTE'">
                    <span class="label">Valor</span>
                    <input v-model.number="change.value" type="number" class="input">
                  </label>
                  <label v-if="change.operation !== 'NOTE'">
                    <span class="label">Nota</span>
                    <input v-model="change.note" class="input" placeholder="+1 em Forca, proficiencia...">
                  </label>
                  <button type="button" class="self-end rounded-lg border border-flare/30 p-3 text-flare hover:bg-flare/10" title="Remover alteracao" @click="removeLevelChange(level, changeIndex)">
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
                <p v-if="level.changes.length === 0" class="rounded-lg border border-dashed border-white/10 p-3 text-sm text-mist">Sem alteracoes neste nivel.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppCard>

    <AppCard v-else-if="currentStep === 'Preview'">
      <h2 class="text-xl font-black text-white">Pre-visualizacao da ficha</h2>
      <div class="mt-5 grid gap-4 md:grid-cols-2">
        <div v-for="field in fields" :key="field.key" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <p class="text-xs font-bold uppercase tracking-[0.12em] text-ember">{{ categoryLabel(field.category) }}</p>
          <p class="mt-1 font-bold text-white">{{ field.label }}</p>
          <p class="text-sm text-mist">Tipo: {{ field.type }} | Padrao: {{ field.defaultValue }}</p>
        </div>
      </div>
      <div v-if="classes.length" class="mt-5">
        <h3 class="text-lg font-black text-white">Classes</h3>
        <div class="mt-3 grid gap-4 md:grid-cols-2">
          <div v-for="rpgClass in classes" :key="rpgClass.id || rpgClass.key" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p class="font-black text-white">{{ rpgClass.name }}</p>
            <p class="text-sm text-mist">{{ rpgClass.maxLevel }} niveis | {{ rpgClass.levels.reduce((sum, level) => sum + level.changes.length, 0) }} alteracoes</p>
          </div>
        </div>
      </div>
      <div v-if="schema.sheetSections?.length" class="mt-5">
        <h3 class="text-lg font-black text-white">Secoes da ficha</h3>
        <div class="mt-3 grid gap-4 md:grid-cols-2">
          <div v-for="item in schema.sheetSections.filter((section) => section.enabled !== false)" :key="item.id || item.key" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p class="font-black text-white">{{ item.title }}</p>
            <p class="mt-1 text-sm leading-6 text-mist">{{ item.multiple ? 'Lista preenchida pelo jogador.' : 'Bloco unico preenchido pelo jogador.' }}</p>
          </div>
        </div>
      </div>
      <div v-if="schema.rulesMarkdown" class="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <h3 class="text-lg font-black text-white">Regras gerais</h3>
        <p class="mt-1 text-sm text-mist">Texto Markdown definido no sistema para leitura na ficha.</p>
      </div>
      <div v-if="schema.sheetLists?.some((list) => list.enabled !== false)" class="mt-5">
        <h3 class="text-lg font-black text-white">Listas especiais</h3>
        <div class="mt-3 grid gap-4 md:grid-cols-2">
          <div v-for="item in schema.sheetLists.filter((list) => list.enabled !== false)" :key="item.id || item.key" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p class="font-black text-white">{{ item.name }}</p>
            <p class="mt-1 text-sm leading-6 text-mist">{{ item.description || 'Lista editavel na ficha.' }}</p>
          </div>
        </div>
      </div>
    </AppCard>

    <AppCard v-else>
      <h2 class="text-xl font-black text-white">Publicar sistema</h2>
      <p class="mt-2 text-mist">Revise os campos, escolha a visibilidade e salve. O sistema ficara pronto para gerar fichas dinamicas.</p>
      <slot name="publish" />
    </AppCard>
  </div>
</template>
