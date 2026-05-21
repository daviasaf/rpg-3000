<script setup lang="ts">
import type { DynamicField, SystemSchema } from '../../../../shared/types/system'
import { fieldsFromSheetTabs, normalizeSheetTabs } from '~~/shared/utils/sheetTabs'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { push, apiError } = useToast()
const loading = ref(false)
const formErrors = ref<string[]>([])
const basic = reactive({
  name: '',
  description: '',
  avatarUrl: '',
  tags: '',
  visibility: 'PUBLIC'
})
const schema = ref<SystemSchema>({
  primaryResource: 'vida',
  defaultRoll: '1d20 + atributo',
  categories: [],
  rulesMarkdown: '',
  sheetTabs: [],
  sheetSections: [],
  sheetTexts: [],
  sheetLists: [],
  leveling: {
    levelOneAttributePoints: 6,
    attributesPerLevel: 1,
    levelOneAttributeLimit: 5,
    attributeLimitIncreasePerLevel: 1,
    maxAttributeLimit: 20
  },
  classes: []
})
const fields = ref<DynamicField[]>([])

async function submit() {
  formErrors.value = validateDraft()
  if (formErrors.value.length) {
    push('Corrija os pontos destacados antes de publicar o sistema.', 'error')
    return
  }

  loading.value = true
  try {
    const normalizedSchema = normalizeSchema(schema.value, fields.value)
    const normalizedFields = fieldsFromSheetTabs(normalizedSchema.sheetTabs || [], fields.value).map(normalizeField)

    const response = await $fetch<{ system: { id: string } }>('/api/systems', {
      method: 'POST',
      body: {
        name: basic.name,
        description: basic.description,
        avatarUrl: basic.avatarUrl,
        tags: basic.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        visibility: basic.visibility,
        schemaJson: normalizedSchema,
        fields: normalizedFields
      }
    })
    push(basic.visibility === 'PUBLIC' ? 'Sistema enviado para analise.' : 'Sistema criado.', 'success')
    await navigateTo(`/app/systems/${response.system.id}`)
  } catch (error) {
    apiError(error, 'Nao foi possivel criar o sistema.')
  } finally {
    loading.value = false
  }
}

function validateDraft() {
  const errors: string[] = []

  if (basic.name.trim().length < 2) {
    errors.push('Informe o nome do sistema com pelo menos 2 caracteres.')
  }

  if (basic.description.trim().length < 8) {
    errors.push('Escreva uma descricao do sistema com pelo menos 8 caracteres.')
  }

  const seenKeys = new Set<string>()
  fields.value.forEach((field, index) => {
    const fieldName = field.label?.trim() || `Campo ${index + 1}`
    const key = keyFromLabel(field.key || field.label || '')

    if (!field.label?.trim() || field.label.trim().length < 2) {
      errors.push(`${fieldName}: informe um nome com pelo menos 2 caracteres.`)
    }

    if (!key || key.length < 2) {
      errors.push(`${fieldName}: a chave tecnica precisa ter pelo menos 2 caracteres.`)
    }

    if (seenKeys.has(key)) {
      errors.push(`${fieldName}: a chave "${key}" esta repetida. Cada campo precisa ter uma chave unica.`)
    }
    seenKeys.add(key)

    if (field.type === 'NUMBER' && Number.isNaN(Number(field.defaultValue ?? 0))) {
      errors.push(`${fieldName}: o valor padrao precisa ser numerico, por exemplo 1 ou 10.`)
    }

    if (field.type === 'LIST') {
      const options = normalizeOptions(field.optionsJson)
      if (options.length === 0) {
        errors.push(`${fieldName}: campos de lista precisam ter pelo menos uma opcao.`)
      }
    }
  })

  const fieldKeys = new Set(fields.value.map((field) => keyFromLabel(field.key || field.label || '')))
  ;(schema.value.sheetTexts || []).forEach((item, index) => {
    const label = item.name?.trim() || `Texto ${index + 1}`
    if (!item.name?.trim()) errors.push(`${label}: informe o nome do texto.`)
    if (!item.text?.trim()) errors.push(`${label}: informe o texto exibido na ficha.`)
  })

  const sectionKeys = new Set<string>()
  ;(schema.value.sheetSections || []).forEach((item, index) => {
    const label = item.title?.trim() || `Secao ${index + 1}`
    const key = keyFromLabel(item.key || item.title || '')
    if (!item.title?.trim()) errors.push(`${label}: informe o nome da secao.`)
    if (!key || key.length < 2) errors.push(`${label}: informe uma chave tecnica com pelo menos 2 caracteres.`)
    if (sectionKeys.has(key)) errors.push(`${label}: a chave da secao esta repetida.`)
    sectionKeys.add(key)
  })

  const listKeys = new Set<string>()
  ;(schema.value.sheetLists || []).forEach((item, index) => {
    const label = item.name?.trim() || `Lista ${index + 1}`
    const key = keyFromLabel(item.key || item.name || '')
    if (!item.name?.trim()) errors.push(`${label}: informe o nome da lista.`)
    if (!key || key.length < 2) errors.push(`${label}: informe uma chave tecnica com pelo menos 2 caracteres.`)
    if (listKeys.has(key)) errors.push(`${label}: a chave da lista esta repetida.`)
    listKeys.add(key)
  })

  const tabKeys = new Set<string>()
  ;(schema.value.sheetTabs || []).forEach((tab, index) => {
    const label = tab.name?.trim() || `Aba ${index + 1}`
    const key = keyFromLabel(tab.key || tab.name || '')
    if (!tab.name?.trim()) errors.push(`${label}: informe o nome da aba.`)
    if (!key || key.length < 2) errors.push(`${label}: a chave interna nao foi gerada corretamente.`)
    if (tabKeys.has(key)) errors.push(`${label}: existe outra aba com a mesma chave interna.`)
    tabKeys.add(key)

    const fieldKeys = new Set<string>()
    ;(tab.fields || []).forEach((field) => {
      const fieldKey = keyFromLabel(field.key || field.label || '')
      if (!field.label?.trim()) errors.push(`${label}: existe um campo sem nome.`)
      if (fieldKeys.has(fieldKey)) errors.push(`${label}: o campo "${field.label}" esta repetido.`)
      fieldKeys.add(fieldKey)
    })
  })

  const classKeys = new Set<string>()
  ;(schema.value.classes || []).forEach((rpgClass) => {
    const className = rpgClass.name?.trim() || 'Classe'
    const key = keyFromLabel(rpgClass.key || rpgClass.name || '')

    if (!key || key.length < 2) {
      errors.push(`${className}: informe uma chave tecnica com pelo menos 2 caracteres.`)
    }

    if (classKeys.has(key)) {
      errors.push(`${className}: a chave da classe esta repetida.`)
    }
    classKeys.add(key)

    if (!rpgClass.maxLevel || Number(rpgClass.maxLevel) < 1) {
      errors.push(`${className}: informe pelo menos 1 nivel.`)
    }

    rpgClass.levels.forEach((level) => {
      level.changes.forEach((change) => {
        if (change.operation !== 'NOTE' && !fieldKeys.has(change.targetKey || '')) {
          errors.push(`${className} nivel ${level.level}: escolha um atributo, pericia ou recurso valido.`)
        }
        if (change.operation === 'NOTE' && !change.note?.trim()) {
          errors.push(`${className} nivel ${level.level}: escreva o texto que deve aparecer na ficha.`)
        }
      })
    })
  })

  return errors
}

function normalizeField(field: DynamicField, index: number) {
  const type = field.type
  return {
    ...field,
    key: keyFromLabel(field.key || field.label),
    defaultValue: normalizeDefaultValue(field),
    optionsJson: type === 'LIST' ? normalizeOptions(field.optionsJson) : field.optionsJson,
    order: index
  }
}

function normalizeDefaultValue(field: DynamicField) {
  if (field.type === 'NUMBER') return Number(field.defaultValue ?? 0)
  if (field.type === 'BOOLEAN') return Boolean(field.defaultValue)
  if (field.type === 'LIST') return String(field.defaultValue ?? normalizeOptions(field.optionsJson)[0] ?? '')
  return field.defaultValue ?? ''
}

function normalizeOptions(options: unknown) {
  if (Array.isArray(options)) return options.map(String).map((item) => item.trim()).filter(Boolean)
  if (typeof options === 'string') return options.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

function normalizeSchema(currentSchema: SystemSchema, currentFields: DynamicField[]) {
  const normalizedTabs = normalizeSheetTabs(currentSchema)
  const normalizedFields = fieldsFromSheetTabs(normalizedTabs, currentFields)
  const targetLabels = new Map(normalizedFields.map((field) => [field.key, field.label]))
  const rulesMarkdown = normalizedTabs
    .filter((tab) => tab.type === 'RULES')
    .map((tab) => tab.systemMarkdown?.trim())
    .filter(Boolean)
    .join('\n\n')

  return {
    ...currentSchema,
    primaryResource: keyFromLabel(currentSchema.primaryResource || 'vida'),
    rulesMarkdown,
    sheetTabs: normalizedTabs,
    sheetSections: (currentSchema.sheetSections || [])
      .map((item, index) => ({
        id: item.id || `section_${index + 1}`,
        key: keyFromLabel(item.key || item.title),
        title: item.title.trim(),
        enabled: item.enabled !== false,
        multiple: Boolean(item.multiple),
        longText: Boolean(item.longText),
        allowDamage: Boolean(item.allowDamage),
        allowSkill: Boolean(item.allowSkill),
        allowExtras: Boolean(item.allowExtras)
      }))
      .filter((item) => item.key && item.title),
    sheetTexts: (currentSchema.sheetTexts || [])
      .map((item, index) => ({
        id: item.id || `sheet_text_${index + 1}`,
        name: item.name.trim(),
        text: item.text.trim()
      }))
      .filter((item) => item.name && item.text),
    sheetLists: (currentSchema.sheetLists || [])
      .map((item, index) => ({
        id: item.id || `sheet_list_${index + 1}`,
        key: keyFromLabel(item.key || item.name),
        name: item.name.trim(),
        description: item.description?.trim() || '',
        enabled: item.enabled !== false,
        allowDamage: Boolean(item.allowDamage),
        allowSkill: Boolean(item.allowSkill),
        allowExtras: item.allowExtras !== false
      }))
      .filter((item) => item.key && item.name),
    leveling: {
      levelOneAttributePoints: Math.max(0, Math.min(200, Number(currentSchema.leveling?.levelOneAttributePoints ?? 6))),
      attributesPerLevel: Math.max(0, Math.min(100, Number(currentSchema.leveling?.attributesPerLevel ?? 1))),
      levelOneAttributeLimit: Math.max(1, Math.min(100, Number(currentSchema.leveling?.levelOneAttributeLimit ?? 5))),
      attributeLimitIncreasePerLevel: Math.max(0, Math.min(100, Number(currentSchema.leveling?.attributeLimitIncreasePerLevel ?? 1))),
      maxAttributeLimit: Math.max(1, Math.min(200, Number(currentSchema.leveling?.maxAttributeLimit ?? 20)))
    },
    classes: (currentSchema.classes || []).map((rpgClass, classIndex) => ({
      id: rpgClass.id || `class_${classIndex + 1}`,
      key: keyFromLabel(rpgClass.key || rpgClass.name),
      name: rpgClass.name.trim(),
      description: rpgClass.description?.trim() || '',
      maxLevel: Math.max(1, Math.min(100, Number(rpgClass.maxLevel || 1))),
      levels: rpgClass.levels
        .filter((level) => level.level <= Number(rpgClass.maxLevel || 1))
        .map((level) => ({
          level: Number(level.level),
          changes: level.changes.map((change) => ({
            targetKey: change.operation === 'NOTE' ? undefined : keyFromLabel(change.targetKey || ''),
            targetLabel: change.operation === 'NOTE' ? undefined : targetLabels.get(keyFromLabel(change.targetKey || '')) || change.targetLabel || change.targetKey,
            operation: change.operation,
            value: Number(change.value || 0),
            note: change.note?.trim() || ''
          }))
        }))
    }))
  }
}

function defaultSheetSections(): NonNullable<SystemSchema['sheetSections']> {
  return []
}

function defaultSheetLists(): NonNullable<SystemSchema['sheetLists']> {
  return []
}

function keyFromLabel(label: string) {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '')
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="page-title">Criar sistema generico</h1>
      <p class="muted mt-1">Defina atributos, recursos, pericias, campos, formulas e regras sem alterar codigo.</p>
    </div>
    <AppCard>
      <div class="grid gap-4 md:grid-cols-2">
        <label><span class="label">Nome *</span><input v-model="basic.name" name="systemName" class="input" type="text" placeholder="Meu sistema"></label>
        <label><span class="label">Avatar por URL</span><input v-model="basic.avatarUrl" name="systemAvatar" class="input" type="url" placeholder="https://..."></label>
        <label><span class="label">Tags</span><input v-model="basic.tags" name="tags" class="input" type="text" placeholder="fantasia, d20, investigacao"></label>
        <label class="md:col-span-2"><span class="label">Descricao *</span><textarea v-model="basic.description" rows="3" class="input" /></label>
        <label><span class="label">Visibilidade *</span><select v-model="basic.visibility" class="select"><option value="PUBLIC">Publico</option><option value="PRIVATE">Privado</option></select></label>
      </div>
    </AppCard>
    <AppCard v-if="formErrors.length" class="border-flare/40 bg-flare/10">
      <h2 class="text-lg font-black text-white">Antes de publicar, corrija:</h2>
      <ul class="mt-3 space-y-2 text-sm text-red-100">
        <li v-for="error in formErrors" :key="error" class="flex gap-2">
          <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-flare" />
          <span>{{ error }}</span>
        </li>
      </ul>
    </AppCard>
    <DynamicSheetBuilder v-model:fields="fields" v-model:schema="schema">
      <template #publish>
        <AppButton class="mt-5" :loading="loading" @click="submit">Publicar sistema</AppButton>
      </template>
    </DynamicSheetBuilder>
  </div>
</template>
