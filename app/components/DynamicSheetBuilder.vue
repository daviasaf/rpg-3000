<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import type { DynamicField, FieldCategory, FieldType, SystemClass, SystemClassLevel, SystemClassLevelChange, SystemSchema } from '../../shared/types/system'

const fields = defineModel<DynamicField[]>('fields', { required: true })
const schema = defineModel<SystemSchema>('schema', { required: true })

const steps = ['Informacoes', 'Regras de nivel', 'Atributos', 'Recursos', 'Pericias', 'Classes', 'Campos', 'Rolagens', 'Preview', 'Publicar']
const current = ref(0)

const categories: Record<string, FieldCategory> = {
  Atributos: 'ATTRIBUTE',
  Recursos: 'RESOURCE',
  Pericias: 'SKILL',
  Campos: 'TEXT_FIELD',
  Rolagens: 'ROLL_RULE'
}

const currentStep = computed(() => steps[current.value] || 'Informacoes')
const currentCategory = computed(() => categories[currentStep.value])
const classTargets = computed(() => fields.value.filter((field) => ['ATTRIBUTE', 'SKILL', 'RESOURCE'].includes(field.category)))
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

function removeLevelChange(level: SystemClassLevel, index: number) {
  level.changes.splice(index, 1)
}

function syncTargetLabel(change: SystemClassLevelChange) {
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

    <AppCard v-else-if="currentStep === 'Classes'">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-black text-white">Classes e progresso por nivel</h2>
          <p class="muted">Defina como cada classe altera atributos, pericias ou recursos em cada nivel.</p>
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
                <AppButton type="button" variant="subtle" @click="addLevelChange(level)"><Plus class="h-4 w-4" />Alteracao</AppButton>
              </div>

              <div class="mt-3 space-y-2">
                <div
                  v-for="(change, changeIndex) in level.changes"
                  :key="changeIndex"
                  class="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 lg:grid-cols-[1fr_110px_110px_1fr_auto]"
                >
                  <label>
                    <span class="label">Alvo</span>
                    <select v-model="change.targetKey" class="select" @change="syncTargetLabel(change)">
                      <option v-for="target in classTargets" :key="target.key" :value="target.key">{{ target.label }} ({{ target.category }})</option>
                    </select>
                  </label>
                  <label>
                    <span class="label">Regra</span>
                    <select v-model="change.operation" class="select">
                      <option value="ADD">Somar</option>
                      <option value="SET">Definir</option>
                    </select>
                  </label>
                  <label>
                    <span class="label">Valor</span>
                    <input v-model.number="change.value" type="number" class="input">
                  </label>
                  <label>
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
    </AppCard>

    <AppCard v-else>
      <h2 class="text-xl font-black text-white">Publicar sistema</h2>
      <p class="mt-2 text-mist">Revise os campos, escolha a visibilidade e salve. O sistema ficara pronto para gerar fichas dinamicas.</p>
      <slot name="publish" />
    </AppCard>
  </div>
</template>
