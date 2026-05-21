<script setup lang="ts">
import type { DynamicField, SystemSchema } from '../../../../../shared/types/system'
import { fieldsFromSheetTabs, normalizeSheetTabs } from '~~/shared/utils/sheetTabs'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const { push, apiError } = useToast()
const loading = ref(false)
const formErrors = ref<string[]>([])
const { data } = await useFetch<{ system: {
  id: string
  name: string
  description: string
  avatarUrl?: string | null
  tags: string[]
  visibility: 'PUBLIC' | 'PRIVATE'
  moderationStatus?: string
  moderationReason?: string | null
  schemaJson?: SystemSchema
  fields: DynamicField[]
} }>(`/api/systems/${route.params.id}`)

const basic = reactive({
  name: data.value?.system.name || '',
  description: data.value?.system.description || '',
  avatarUrl: data.value?.system.avatarUrl || '',
  tags: data.value?.system.tags.join(', ') || '',
  visibility: data.value?.system.visibility || 'PUBLIC'
})
const schema = ref<SystemSchema>({
  primaryResource: data.value?.system.schemaJson?.primaryResource || 'vida',
  defaultRoll: data.value?.system.schemaJson?.defaultRoll || '1d20 + atributo',
  notes: data.value?.system.schemaJson?.notes || '',
  categories: data.value?.system.schemaJson?.categories || [],
  rulesMarkdown: data.value?.system.schemaJson?.rulesMarkdown || '',
  sheetTabs: data.value?.system.schemaJson?.sheetTabs || [],
  sheetSections: data.value?.system.schemaJson?.sheetSections || [],
  sheetTexts: data.value?.system.schemaJson?.sheetTexts || [],
  sheetLists: data.value?.system.schemaJson?.sheetLists || [],
  leveling: {
    levelOneAttributePoints: data.value?.system.schemaJson?.leveling?.levelOneAttributePoints ?? 6,
    attributesPerLevel: data.value?.system.schemaJson?.leveling?.attributesPerLevel ?? 1,
    levelOneAttributeLimit: data.value?.system.schemaJson?.leveling?.levelOneAttributeLimit ?? 5,
    attributeLimitIncreasePerLevel: data.value?.system.schemaJson?.leveling?.attributeLimitIncreasePerLevel ?? 1,
    maxAttributeLimit: data.value?.system.schemaJson?.leveling?.maxAttributeLimit ?? 20
  },
  classes: data.value?.system.schemaJson?.classes || []
})
const fields = ref<DynamicField[]>((data.value?.system.fields || []).map((field, index) => ({ ...field, order: field.order ?? index })))
const isRejected = computed(() => data.value?.system.moderationStatus === 'REJECTED')

async function submit() {
  if (isRejected.value) return
  formErrors.value = validateDraft()
  if (formErrors.value.length) {
    push('Corrija os pontos destacados antes de salvar o sistema.', 'error')
    return
  }

  loading.value = true
  try {
    const normalizedSchema = normalizeSchema(schema.value, fields.value)
    const normalizedFields = fieldsFromSheetTabs(normalizedSchema.sheetTabs || [], fields.value).map(normalizeField)
    await $fetch(`/api/systems/${route.params.id}`, {
      method: 'PUT',
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
    push('Sistema atualizado.', 'success')
    await navigateTo(`/app/systems/${route.params.id}`)
  } catch (error) {
    apiError(error, 'Nao foi possivel editar o sistema.')
  } finally {
    loading.value = false
  }
}

async function publishSystem() {
  if (isRejected.value) return
  loading.value = true
  try {
    await $fetch(`/api/systems/${route.params.id}/publish`, { method: 'POST' })
    push('Sistema enviado para analise da comunidade.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel publicar o sistema.')
  } finally {
    loading.value = false
  }
}

function validateDraft() {
  const errors: string[] = []
  if (basic.name.trim().length < 2) errors.push('Informe o nome do sistema.')
  if (basic.description.trim().length < 8) errors.push('Escreva uma descricao com pelo menos 8 caracteres.')

  const seenKeys = new Set<string>()
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

  fields.value.forEach((field, index) => {
    const fieldName = field.label?.trim() || `Campo ${index + 1}`
    const key = keyFromLabel(field.key || field.label || '')
    if (!field.label?.trim()) errors.push(`${fieldName}: informe um nome.`)
    if (!key || key.length < 2) errors.push(`${fieldName}: a chave tecnica precisa ter pelo menos 2 caracteres.`)
    if (seenKeys.has(key)) errors.push(`${fieldName}: chave repetida.`)
    seenKeys.add(key)
    if (field.type === 'NUMBER' && Number.isNaN(Number(field.defaultValue ?? 0))) errors.push(`${fieldName}: valor padrao precisa ser numerico.`)
  })

  return errors
}

function normalizeField(field: DynamicField, index: number) {
  return {
    ...field,
    key: keyFromLabel(field.key || field.label),
    defaultValue: normalizeDefaultValue(field),
    optionsJson: field.type === 'LIST' ? normalizeOptions(field.optionsJson) : field.optionsJson,
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
      levels: rpgClass.levels.map((level) => ({
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
  <div v-if="data?.system" class="space-y-5">
    <div>
      <h1 class="page-title">Editar sistema</h1>
      <p class="muted mt-1">Ajuste campos, classes e regras dinamicas.</p>
    </div>
    <AppCard v-if="isRejected" class="border-flare/40 bg-flare/10">
      <h2 class="font-black text-white">Sistema rejeitado</h2>
      <p class="mt-2 text-sm text-red-100">{{ data.system.moderationReason || 'Este sistema esta bloqueado para edicao. Crie uma nova versao para enviar novamente.' }}</p>
    </AppCard>
    <AppCard>
      <div class="grid gap-4 md:grid-cols-2">
        <label><span class="label">Nome *</span><input v-model="basic.name" class="input" type="text"></label>
        <label><span class="label">Avatar por URL</span><input v-model="basic.avatarUrl" class="input" type="url" placeholder="https://..."></label>
        <label><span class="label">Tags</span><input v-model="basic.tags" class="input" type="text"></label>
        <label class="md:col-span-2"><span class="label">Descricao *</span><textarea v-model="basic.description" rows="3" class="input" /></label>
        <label><span class="label">Visibilidade *</span><select v-model="basic.visibility" class="select"><option value="PUBLIC">Publico</option><option value="PRIVATE">Privado</option></select></label>
      </div>
    </AppCard>
    <AppCard v-if="formErrors.length" class="border-flare/40 bg-flare/10">
      <h2 class="text-lg font-black text-white">Antes de salvar, corrija:</h2>
      <ul class="mt-3 space-y-2 text-sm text-red-100">
        <li v-for="error in formErrors" :key="error">{{ error }}</li>
      </ul>
    </AppCard>
    <DynamicSheetBuilder v-model:fields="fields" v-model:schema="schema">
      <template #publish>
        <div class="mt-5 flex flex-wrap gap-2">
          <AppButton :loading="loading" :disabled="isRejected" @click="submit">Salvar alteracoes</AppButton>
          <AppButton variant="ghost" :loading="loading" :disabled="isRejected" @click="publishSystem">Republicar na comunidade</AppButton>
        </div>
      </template>
    </DynamicSheetBuilder>
  </div>
</template>
