import type { DynamicField, FieldCategory, FieldType, SheetFieldType, SheetTab, SheetTabField, SheetTabRecord, SheetTabType, SystemSchema } from '../types/system'

export const sheetTabTypeLabels: Record<SheetTabType, string> = {
  ATTRIBUTES: 'Atributos',
  RESOURCES: 'Recursos',
  SKILLS: 'Pericias',
  CLASS_PROGRESS: 'Classes / Progressao',
  ITEMS: 'Itens',
  WEAPONS: 'Armas',
  TRAITS: 'Tracos / Talentos',
  POWERS: 'Poderes / Magias / Tecnicas',
  TEXT_BLOCKS: 'Blocos de texto',
  CONDITIONS: 'Condicoes / Estados',
  RULES: 'Regras gerais',
  ROLLS: 'Rolagens',
  CUSTOM: 'Aba personalizada'
}

export const sheetFieldTypeLabels: Record<SheetFieldType, string> = {
  SHORT_TEXT: 'Texto curto',
  LONG_TEXT: 'Texto longo',
  NUMBER: 'Numero',
  CHECKBOX: 'Checkbox',
  SELECT: 'Select',
  LIST: 'Lista',
  DAMAGE: 'Dano',
  ROLL: 'Formula de rolagem',
  COST: 'Custo',
  RANGE: 'Alcance',
  BONUS: 'Bonus / aumento',
  IMAGE: 'Imagem / avatar',
  TAGS: 'Tags',
  EXTRA_PAIR: 'Campo extra nome + valor'
}

export function keyFromLabel(label: string) {
  return String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '')
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function createSheetTab(type: SheetTabType, index = 0): SheetTab {
  const name = sheetTabTypeLabels[type]
  const base: SheetTab = {
    id: uid('sheet_tab'),
    name,
    key: uniqueKey(name, index),
    type,
    description: '',
    order: index,
    enabled: true,
    readonly: type === 'RULES',
    playerEditable: type !== 'RULES',
    allowMultiple: !['RULES'].includes(type),
    allowExtraFields: ['ITEMS', 'WEAPONS', 'TRAITS', 'POWERS', 'CONDITIONS', 'CUSTOM'].includes(type),
    allowRolls: ['ITEMS', 'WEAPONS', 'POWERS', 'CONDITIONS', 'ROLLS', 'CUSTOM'].includes(type),
    allowBonuses: ['CLASS_PROGRESS', 'ITEMS', 'WEAPONS', 'TRAITS', 'POWERS', 'CONDITIONS', 'CUSTOM'].includes(type),
    allowDamageCostAbility: ['ITEMS', 'WEAPONS', 'POWERS', 'CUSTOM'].includes(type),
    textMode: type === 'TEXT_BLOCKS' ? 'LIST' : undefined,
    fields: defaultFieldsForType(type),
    records: defaultRecordsForType(type),
    systemMarkdown: type === 'RULES' ? '' : undefined
  }

  if (type === 'CUSTOM') {
    base.name = 'Aba personalizada'
    base.key = uniqueKey(base.name, index)
    base.description = 'Monte seus proprios campos para esta parte da ficha.'
  }

  return base
}

function uniqueKey(label: string, index: number) {
  const key = keyFromLabel(label)
  return index > 0 ? `${key}_${index + 1}` : key
}

export function defaultFieldsForType(type: SheetTabType): SheetTabField[] {
  const field = (label: string, type: SheetFieldType, order: number, extra: Partial<SheetTabField> = {}): SheetTabField => ({
    id: uid('sheet_field'),
    label,
    key: keyFromLabel(label),
    type,
    required: false,
    defaultValue: type === 'NUMBER' ? 0 : type === 'CHECKBOX' ? false : '',
    order,
    ...extra
  })

  if (type === 'ATTRIBUTES') return [field('Valor', 'NUMBER', 0), field('Minimo', 'NUMBER', 1), field('Maximo', 'NUMBER', 2), field('Descricao', 'LONG_TEXT', 3)]
  if (type === 'RESOURCES') return [field('Valor atual', 'NUMBER', 0), field('Valor maximo', 'NUMBER', 1), field('Descricao', 'LONG_TEXT', 2)]
  if (type === 'SKILLS') return [field('Valor', 'NUMBER', 0), field('Atributo relacionado', 'SHORT_TEXT', 1), field('Descricao', 'LONG_TEXT', 2)]
  if (type === 'ITEMS') return [field('Texto', 'LONG_TEXT', 0), field('Rolagem', 'ROLL', 1), field('Dano', 'DAMAGE', 2), field('Bonus', 'BONUS', 3), field('Quantidade', 'NUMBER', 4)]
  if (type === 'WEAPONS') return [field('Texto', 'LONG_TEXT', 0), field('Dano', 'DAMAGE', 1), field('Habilidade', 'SHORT_TEXT', 2), field('Rolagem', 'ROLL', 3), field('Bonus', 'BONUS', 4)]
  if (type === 'TRAITS') return [field('Texto', 'LONG_TEXT', 0), field('Bonus', 'BONUS', 1), field('Efeito', 'LONG_TEXT', 2)]
  if (type === 'POWERS') return [field('Texto', 'LONG_TEXT', 0), field('Dano', 'DAMAGE', 1), field('Custo', 'COST', 2), field('Alcance', 'RANGE', 3), field('Rolagem', 'ROLL', 4), field('Bonus', 'BONUS', 5)]
  if (type === 'TEXT_BLOCKS') return [field('Texto', 'LONG_TEXT', 0)]
  if (type === 'CONDITIONS') return [field('Texto', 'LONG_TEXT', 0), field('Efeito', 'LONG_TEXT', 1), field('Bonus ou penalidade', 'BONUS', 2), field('Rolagem', 'ROLL', 3)]
  if (type === 'ROLLS') return [field('Formula', 'ROLL', 0), field('Dado base', 'SHORT_TEXT', 1), field('Atributo usado', 'SHORT_TEXT', 2), field('Modificador', 'NUMBER', 3), field('Descricao', 'LONG_TEXT', 4)]
  if (type === 'CUSTOM') return [field('Nome', 'SHORT_TEXT', 0, { required: true }), field('Descricao', 'LONG_TEXT', 1)]
  return []
}

export function defaultRecordsForType(type: SheetTabType): SheetTabRecord[] {
  if (type === 'CLASS_PROGRESS' || type === 'RULES' || type === 'CUSTOM') return []
  return []
}

export function normalizeSheetTabs(schema: SystemSchema | undefined): SheetTab[] {
  const existing = schema?.sheetTabs
  if (existing?.length) {
    return existing
      .map((tab, index) => normalizeSheetTab(tab, index))
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
  }

  return legacyTabsFromSchema(schema)
}

export function normalizeSheetTab(tab: SheetTab, index: number): SheetTab {
  const name = String(tab.name || sheetTabTypeLabels[tab.type] || `Aba ${index + 1}`).trim()
  const key = keyFromLabel(tab.key || name)
  return {
    ...tab,
    id: tab.id || uid('sheet_tab'),
    name,
    key,
    description: tab.description || '',
    order: index,
    enabled: tab.enabled !== false,
    readonly: Boolean(tab.readonly || tab.type === 'RULES'),
    playerEditable: tab.type === 'RULES' ? false : tab.playerEditable !== false,
    allowMultiple: tab.type === 'RULES' ? false : tab.allowMultiple !== false,
    allowExtraFields: Boolean(tab.allowExtraFields),
    allowRolls: Boolean(tab.allowRolls),
    allowBonuses: Boolean(tab.allowBonuses),
    allowDamageCostAbility: Boolean(tab.allowDamageCostAbility),
    textMode: tab.textMode || (tab.type === 'TEXT_BLOCKS' ? 'LIST' : undefined),
    fields: (tab.fields?.length ? tab.fields : defaultFieldsForType(tab.type)).map((field, fieldIndex) => normalizeSheetTabField(field, fieldIndex)),
    records: (tab.records || []).map((record, recordIndex) => normalizeSheetTabRecord(record, recordIndex)),
    systemMarkdown: tab.type === 'RULES' ? String(tab.systemMarkdown || '') : tab.systemMarkdown
  }
}

export function normalizeSheetTabField(field: SheetTabField, index: number): SheetTabField {
  const label = String(field.label || `Campo ${index + 1}`).trim()
  return {
    ...field,
    id: field.id || uid('sheet_field'),
    label,
    key: keyFromLabel(field.key || label),
    type: field.type || 'SHORT_TEXT',
    required: Boolean(field.required),
    options: Array.isArray(field.options) ? field.options.map(String).map((item) => item.trim()).filter(Boolean) : [],
    order: index
  }
}

export function normalizeSheetTabRecord(record: SheetTabRecord, index: number): SheetTabRecord {
  return {
    ...record,
    id: record.id || uid('sheet_record'),
    name: String(record.name || `Registro ${index + 1}`).trim(),
    description: record.description || '',
    text: record.text || '',
    extraFields: record.extraFields || []
  }
}

export function legacyTabsFromSchema(schema: SystemSchema | undefined): SheetTab[] {
  const tabs: SheetTab[] = []
  let order = 0

  const legacySections = schema?.sheetSections || []
  for (const section of legacySections.filter((item) => item.enabled !== false)) {
    const type = legacySectionType(section.key, section.longText)
    tabs.push({
      ...createSheetTab(type, order),
      id: section.id || uid('legacy_tab'),
      key: keyFromLabel(section.key || section.title),
      name: section.title,
      order,
      allowMultiple: Boolean(section.multiple),
      allowExtraFields: Boolean(section.allowExtras),
      allowRolls: Boolean(section.allowDamage || section.allowSkill),
      allowBonuses: Boolean(section.allowSkill),
      allowDamageCostAbility: Boolean(section.allowDamage || section.allowSkill)
    })
    order += 1
  }

  const legacyLists = schema?.sheetLists || []
  for (const list of legacyLists.filter((item) => item.enabled !== false)) {
    tabs.push({
      ...createSheetTab(list.key === 'spells' ? 'POWERS' : 'ITEMS', order),
      id: list.id || uid('legacy_list'),
      key: keyFromLabel(list.key || list.name),
      name: list.name,
      description: list.description || '',
      order,
      allowExtraFields: list.allowExtras !== false,
      allowRolls: Boolean(list.allowDamage || list.allowSkill),
      allowBonuses: Boolean(list.allowSkill),
      allowDamageCostAbility: Boolean(list.allowDamage || list.allowSkill)
    })
    order += 1
  }

  if (schema?.rulesMarkdown?.trim()) {
    tabs.push({ ...createSheetTab('RULES', order), name: 'Regras gerais', key: 'regras_gerais', order, systemMarkdown: schema.rulesMarkdown })
  }

  return tabs
}

function legacySectionType(key: string, longText?: boolean): SheetTabType {
  if (key === 'weapons') return 'WEAPONS'
  if (key === 'powers') return 'POWERS'
  if (key === 'traits') return 'TRAITS'
  if (key === 'conditions') return 'CONDITIONS'
  if (longText) return 'TEXT_BLOCKS'
  return 'ITEMS'
}

export function fieldsFromSheetTabs(tabs: SheetTab[], existingFields: DynamicField[] = []): DynamicField[] {
  const oldNonTabFields = existingFields.filter((field) => !['ATTRIBUTE', 'RESOURCE', 'SKILL', 'ROLL_RULE'].includes(field.category))
  const generated: DynamicField[] = []

  for (const tab of tabs.filter((item) => item.enabled !== false)) {
    const category = fieldCategoryForTab(tab.type)
    if (!category) continue

    const records = tab.records || []
    records.forEach((record, recordIndex) => {
      const key = keyFromLabel(`${tab.key}_${record.name}`)
      generated.push({
        id: record.id,
        key,
        label: record.name,
        type: fieldTypeForTab(tab.type),
        category,
        defaultValue: defaultValueForRecord(record, tab.type),
        formula: tab.type === 'ROLLS' ? record.roll || record.fields?.formula as string || '' : undefined,
        order: generated.length + recordIndex
      })
    })
  }

  return [...generated, ...oldNonTabFields].map((field, index) => ({ ...field, order: index }))
}

function fieldCategoryForTab(type: SheetTabType): FieldCategory | null {
  if (type === 'ATTRIBUTES') return 'ATTRIBUTE'
  if (type === 'RESOURCES') return 'RESOURCE'
  if (type === 'SKILLS') return 'SKILL'
  if (type === 'ROLLS') return 'ROLL_RULE'
  return null
}

function fieldTypeForTab(type: SheetTabType): FieldType {
  return type === 'ROLLS' ? 'DICE' : 'NUMBER'
}

function defaultValueForRecord(record: SheetTabRecord, type: SheetTabType) {
  if (type === 'ROLLS') return record.roll || record.fields?.formula || ''
  return Number(record.value ?? 0)
}
