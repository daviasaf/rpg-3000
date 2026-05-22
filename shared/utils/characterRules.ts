import type { DynamicField, SheetTab, SheetTabRecord, SheetTabType, SystemLevelRule, SystemSchema } from '../types/system'
import { formulaKeyFromLabel, normalizeSheetTabs } from './sheetTabs'

const selectableTypes: SheetTabType[] = ['SKILLS', 'ITEMS', 'WEAPONS', 'TRAITS', 'POWERS']

export type RuleTotals = {
  level: number
  attributeBudget: number
  attributePoints: number
  skillChoices: number
  powerChoices: number
  traitChoices: number
  itemChoices: number
  weaponChoices: number
  inventoryCapacity: number
}

export type FormulaVariable = {
  key: string
  label: string
  type: string
}

export function normalizedLevelProgression(schema: SystemSchema | undefined): SystemLevelRule[] {
  const legacy = schema?.leveling
  const rules = schema?.levelProgression?.length
    ? schema.levelProgression
    : [{
        level: 1,
        attributeBudget: Number(legacy?.levelOneAttributePoints ?? 6),
        attributePoints: Number(legacy?.levelOneAttributeLimit ?? 5),
        skillChoices: 0,
        powerChoices: 0,
        traitChoices: 0,
        itemChoices: 0,
        weaponChoices: 0,
        inventoryCapacity: 0,
        notes: ''
      }]

  return rules
    .map((rule, index) => ({
      ...rule,
      id: rule.id || `level_rule_${index + 1}`,
      level: clampInt(rule.level, 1, 100),
      attributeBudget: clampInt(rule.attributeBudget ?? (rule.level === 1 ? legacy?.levelOneAttributePoints ?? rule.attributePoints ?? 6 : legacy?.attributesPerLevel ?? rule.attributePoints ?? 0), 0, 200),
      attributePoints: clampInt(rule.attributePoints ?? (rule.level === 1 ? legacy?.levelOneAttributeLimit ?? 5 : (legacy?.levelOneAttributeLimit ?? 5) + Math.max(0, Number(rule.level || 1) - 1) * (legacy?.attributeLimitIncreasePerLevel ?? 1)), 0, 200),
      skillChoices: clampInt(rule.skillChoices, 0, 100),
      powerChoices: clampInt(rule.powerChoices, 0, 100),
      traitChoices: clampInt(rule.traitChoices, 0, 100),
      itemChoices: clampInt(rule.itemChoices, 0, 100),
      weaponChoices: clampInt(rule.weaponChoices, 0, 100),
      inventoryCapacity: clampInt(rule.inventoryCapacity, 0, 10000),
      resourceGains: rule.resourceGains || [],
      bonusGains: rule.bonusGains || [],
      notes: rule.notes || ''
    }))
    .sort((a, b) => a.level - b.level)
}

export function progressionTotals(schema: SystemSchema | undefined, levelValue: unknown, classKeyValue?: unknown): RuleTotals {
  const level = clampInt(levelValue, 1, 100)
  const totals: RuleTotals = {
    level,
    attributeBudget: 0,
    attributePoints: 0,
    skillChoices: 0,
    powerChoices: 0,
    traitChoices: 0,
    itemChoices: 0,
    weaponChoices: 0,
    inventoryCapacity: 0
  }

  for (const rule of normalizedLevelProgression(schema).filter((item) => item.level <= level)) {
    totals.attributeBudget = Number(rule.attributeBudget || totals.attributeBudget)
    totals.attributePoints = Number(rule.attributePoints || totals.attributePoints)
    totals.skillChoices += Number(rule.skillChoices || 0)
    totals.powerChoices += Number(rule.powerChoices || 0)
    totals.traitChoices += Number(rule.traitChoices || 0)
    totals.itemChoices += Number(rule.itemChoices || 0)
    totals.weaponChoices += Number(rule.weaponChoices || 0)
    totals.inventoryCapacity = Math.max(totals.inventoryCapacity, Number(rule.inventoryCapacity || 0))
  }

  const classInfo = schema?.classes?.find((item) => item.key === String(classKeyValue || ''))
  for (const classLevel of classInfo?.levels?.filter((item) => item.level <= level) || []) {
    totals.skillChoices += Number(classLevel.skillChoices || 0)
    totals.powerChoices += Number(classLevel.powerChoices || 0)
    totals.traitChoices += Number(classLevel.traitChoices || 0)
    totals.itemChoices += Number(classLevel.itemChoices || 0)
    totals.weaponChoices += Number(classLevel.weaponChoices || 0)
    totals.inventoryCapacity = Math.max(totals.inventoryCapacity, Number(classLevel.inventoryCapacity || 0))
  }

  return totals
}

export function validateSystemRules(schema: SystemSchema | undefined, fields: DynamicField[] = []) {
  const errors: string[] = []
  const keys = new Map<string, string>()
  keys.set('NIVEL', 'Nivel do personagem')
  const recordKeys = new Set<string>()

  for (const tab of normalizeSheetTabs(schema)) {
    for (const record of tab.records || []) {
      recordKeys.add(formulaKeyFromLabel(record.key || record.name))
    }
  }

  for (const field of fields) {
    const key = formulaKeyFromLabel(field.key || field.label)
    if (!recordKeys.has(key)) registerKey(keys, key, field.label, errors)
  }

  for (const tab of normalizeSheetTabs(schema)) {
    for (const record of tab.records || []) {
      registerKey(keys, formulaKeyFromLabel(record.key || record.name), `${tab.name}: ${record.name}`, errors)
      if (record.bonusKey) registerKey(keys, formulaKeyFromLabel(record.bonusKey), `${record.name}: bonus`, errors)
      for (const level of record.skillLevels || []) registerKey(keys, formulaKeyFromLabel(level.key || level.name), `${record.name}: ${level.name}`, errors)
      validateFormula(record.roll, keys, `${record.name}: rolagem`, errors)
      validateFormula(record.damage, keys, `${record.name}: dano`, errors)
      validateFormula(record.bonus, keys, `${record.name}: bonus`, errors)
    }
  }

  for (const field of fields) validateFormula(field.formula, keys, `${field.label}: formula`, errors)
  return errors
}

export function validateCharacterData(schema: SystemSchema | undefined, fields: DynamicField[] = [], dataJson: Record<string, unknown> = {}) {
  const errors: string[] = []
  const tabs = normalizeSheetTabs(schema)
  const classKey = String(dataJson.classe || '')
  const classInfo = schema?.classes?.find((item) => item.key === classKey)
  const level = clampInt(dataJson.nivel || 1, 1, classInfo?.maxLevel || 100)
  const totals = progressionTotals(schema, level, classKey)
  const attributeFields = fields.filter((field) => field.category === 'ATTRIBUTE')
  const attributeLimit = attributeLimitForLevel(schema, level)
  let spentAttributes = 0

  for (const field of attributeFields) {
    const value = numberValue(dataJson[field.key])
    const baseValue = value - classAddForField(schema, classKey, level, field.key)
    if (baseValue < 0 || baseValue > attributeLimit) errors.push(`${field.label}: valor fora do limite 0-${attributeLimit}.`)
    spentAttributes += baseValue
  }
  if (attributeFields.length && spentAttributes > totals.attributeBudget) {
    errors.push(`Atributos acima dos pontos disponiveis: ${spentAttributes}/${totals.attributeBudget}.`)
  }

  for (const tab of tabs) validateTabSelection(tab, dataJson, totals, errors)

  const equipmentWeight = tabs
    .filter((tab) => tab.type === 'ITEMS' || tab.type === 'WEAPONS')
    .flatMap((tab) => selectedListRecords(tab, dataJson).map((item) => Number(recordByKey(tab, item.key)?.weight || 0)))
    .reduce((sum, weight) => sum + weight, 0)
  if (totals.inventoryCapacity > 0 && equipmentWeight > totals.inventoryCapacity) {
    errors.push(`Inventario acima da capacidade: ${equipmentWeight}/${totals.inventoryCapacity}.`)
  }

  const values = formulaValues(fields, tabs, dataJson)
  values.set('NIVEL', String(level))
  for (const tab of tabs) {
    for (const record of tab.records || []) {
      validateFormula(record.roll, values, `${record.name}: rolagem`, errors)
      validateFormula(record.damage, values, `${record.name}: dano`, errors)
      validateFormula(record.bonus, values, `${record.name}: bonus`, errors)
    }
  }

  return errors
}

export function formulaValues(fields: DynamicField[] = [], tabs: SheetTab[] = [], dataJson: Record<string, unknown> = {}) {
  const values = new Map<string, string>()
  values.set('NIVEL', String(numberValue(dataJson.nivel || 1)))
  for (const field of fields) values.set(formulaKeyFromLabel(field.key), String(numberValue(dataJson[field.key])))
  for (const tab of tabs) {
    const nested = isRecord(dataJson[tab.key]) ? dataJson[tab.key] as Record<string, unknown> : {}
    for (const record of tab.records || []) {
      const key = formulaKeyFromLabel(record.key || record.name)
      const nestedValue = isRecord(nested[key]) ? (nested[key] as Record<string, unknown>).value ?? (nested[key] as Record<string, unknown>).current : nested[key]
      values.set(key, String(numberValue(dataJson[key] ?? nestedValue ?? record.value ?? 0)))
      if (record.bonusKey) values.set(formulaKeyFromLabel(record.bonusKey), String(extractSignedNumber(record.bonus)))
    }
  }
  return values
}

export function formulaVariableList(schema: SystemSchema | undefined, fields: DynamicField[] = []): FormulaVariable[] {
  const variables: FormulaVariable[] = [{ key: 'NIVEL', label: 'Nivel do personagem', type: 'Sistema' }]
  for (const field of fields) {
    if (!field.key) continue
    variables.push({
      key: formulaKeyFromLabel(field.key),
      label: field.label,
      type: formulaFieldType(field.category)
    })
  }

  for (const tab of normalizeSheetTabs(schema)) {
    for (const record of tab.records || []) {
      const key = formulaKeyFromLabel(record.key || record.name)
      variables.push({ key, label: record.name, type: formulaTabType(tab.type) })
      if (record.bonusKey) variables.push({ key: formulaKeyFromLabel(record.bonusKey), label: `${record.name} - bonus`, type: 'Bonus' })
      for (const level of record.skillLevels || []) {
        variables.push({ key: formulaKeyFromLabel(level.key || level.name), label: `${record.name}: ${level.name}`, type: 'Nivel de pericia' })
      }
    }
  }

  const seen = new Set<string>()
  return variables.filter((variable) => {
    if (!variable.key || seen.has(variable.key)) return false
    seen.add(variable.key)
    return true
  })
}

export function characterFormulaVariableList(schema: SystemSchema | undefined, fields: DynamicField[] = [], dataJson: Record<string, unknown> = {}): FormulaVariable[] {
  const variables: FormulaVariable[] = [{ key: 'NIVEL', label: 'Nivel do personagem', type: 'Sistema' }]
  for (const field of fields) {
    if (!field.key || !(field.key in dataJson)) continue
    variables.push({
      key: formulaKeyFromLabel(field.key),
      label: field.label,
      type: formulaFieldType(field.category)
    })
  }

  for (const tab of normalizeSheetTabs(schema)) {
    if (tab.type === 'SKILLS') {
      for (const item of selectedSkillRecords(tab, dataJson)) {
        const record = recordByKey(tab, item.key)
        if (record) variables.push({ key: formulaKeyFromLabel(record.key || record.name), label: record.name, type: formulaTabType(tab.type) })
      }
      continue
    }

    if (selectableTypes.includes(tab.type)) {
      for (const item of selectedListRecords(tab, dataJson)) {
        const record = recordByKey(tab, item.key)
        if (!record) continue
        variables.push({ key: formulaKeyFromLabel(record.key || record.name), label: record.name, type: formulaTabType(tab.type) })
        if (record.bonusKey) variables.push({ key: formulaKeyFromLabel(record.bonusKey), label: `${record.name} - bonus`, type: 'Bonus' })
      }
      continue
    }

    for (const record of tab.records || []) {
      if (!['ATTRIBUTES', 'RESOURCES'].includes(tab.type)) continue
      variables.push({ key: formulaKeyFromLabel(record.key || record.name), label: record.name, type: formulaTabType(tab.type) })
      if (record.bonusKey) variables.push({ key: formulaKeyFromLabel(record.bonusKey), label: `${record.name} - bonus`, type: 'Bonus' })
    }
  }

  const seen = new Set<string>()
  return variables.filter((variable) => {
    if (!variable.key || seen.has(variable.key)) return false
    seen.add(variable.key)
    return true
  })
}

export function characterFormulaValues(fields: DynamicField[] = [], tabs: SheetTab[] = [], dataJson: Record<string, unknown> = {}) {
  const allowed = new Set(characterFormulaVariableList({ sheetTabs: tabs } as SystemSchema, fields, dataJson).map((item) => item.key))
  const values = formulaValues(fields, tabs, dataJson)
  for (const key of [...values.keys()]) {
    if (!allowed.has(key)) values.delete(key)
  }
  return values
}

export function resolveFormulaExpression(expression: string, values: Map<string, string>) {
  let missing = ''
  const resolved = String(expression || '').replace(/[A-Za-z_][A-Za-z0-9_/-]*/g, (token, offset, source) => {
    const before = offset > 0 ? source[offset - 1] : ''
    if (/\d/.test(before)) return token
    const value = values.get(formulaKeyFromLabel(token))
    if (value === undefined) {
      missing ||= token
      return token
    }
    return value
  })
  return { resolved, missing }
}

function validateTabSelection(tab: SheetTab, dataJson: Record<string, unknown>, totals: RuleTotals, errors: string[]) {
  if (!selectableTypes.includes(tab.type) || !(tab.records || []).length) return

  if (tab.type === 'SKILLS') {
    const selected = selectedSkillRecords(tab, dataJson)
    if (selected.length > totals.skillChoices) errors.push(`${tab.name}: escolha no maximo ${totals.skillChoices} pericias.`)
    for (const item of selected) {
      const record = recordByKey(tab, item.key)
      if (!record) errors.push(`${tab.name}: pericia invalida (${item.key}).`)
      const levelKey = item.levelKey ? formulaKeyFromLabel(item.levelKey) : ''
      if (record?.useSkillLevels && levelKey && !(record.skillLevels || []).some((level) => formulaKeyFromLabel(level.key) === levelKey)) {
        errors.push(`${record.name}: nivel de pericia invalido.`)
      }
    }
    return
  }

  const selected = selectedListRecords(tab, dataJson)
  const limit = selectionLimit(tab.type, totals)
  if (selected.length > limit) errors.push(`${tab.name}: escolha no maximo ${limit} registros.`)
  for (const item of selected) {
    if (!recordByKey(tab, item.key)) errors.push(`${tab.name}: registro invalido (${item.key}).`)
  }

}

function selectedSkillRecords(tab: SheetTab, dataJson: Record<string, unknown>) {
  const raw = isRecord(dataJson[tab.key]) ? dataJson[tab.key] as Record<string, unknown> : {}
  return Object.entries(raw)
    .filter(([, value]) => isRecord(value) && Boolean((value as Record<string, unknown>).selected))
    .map(([key, value]) => ({ key: formulaKeyFromLabel(key), levelKey: String((value as Record<string, unknown>).levelKey || '') }))
}

function selectedListRecords(tab: SheetTab, dataJson: Record<string, unknown>) {
  const raw = Array.isArray(dataJson[tab.key]) ? dataJson[tab.key] as Array<Record<string, unknown>> : []
  return raw.map((item) => ({ key: formulaKeyFromLabel(String(item.sourceRecordKey || item.key || item.name || '')) })).filter((item) => item.key)
}

function recordByKey(tab: SheetTab, key: string) {
  const normalized = formulaKeyFromLabel(key)
  return (tab.records || []).find((record) => formulaKeyFromLabel(record.key || record.name) === normalized)
}

function selectionLimit(type: SheetTabType, totals: RuleTotals) {
  if (type === 'ITEMS' || type === 'WEAPONS') return Number.POSITIVE_INFINITY
  if (type === 'TRAITS') return 1
  if (type === 'POWERS') return totals.powerChoices
  return 0
}

export function attributeBudgetForLevel(schema: SystemSchema | undefined, level: number) {
  return progressionTotals(schema, level).attributeBudget
}

export function attributeLimitForLevel(schema: SystemSchema | undefined, level: number) {
  const progressLimits = normalizedLevelProgression(schema)
    .filter((rule) => rule.level <= level)
    .map((rule) => Number(rule.attributePoints || 0))
    .filter((value) => value > 0)
  if (progressLimits.length) return Math.max(...progressLimits)

  const leveling = schema?.leveling
  const base = Number(leveling?.levelOneAttributeLimit ?? 5)
  const increase = Math.max(0, level - 1) * Number(leveling?.attributeLimitIncreasePerLevel ?? 0)
  return Math.min(Number(leveling?.maxAttributeLimit ?? 20), base + increase)
}

function formulaFieldType(category: string) {
  const labels: Record<string, string> = {
    ATTRIBUTE: 'Atributo',
    SKILL: 'Pericia',
    RESOURCE: 'Recurso',
    STATUS_BAR: 'Recurso',
    FORMULA: 'Formula',
    ROLL_RULE: 'Rolagem'
  }
  return labels[category] || 'Campo'
}

function formulaTabType(type: SheetTabType) {
  const labels: Partial<Record<SheetTabType, string>> = {
    ATTRIBUTES: 'Atributo',
    RESOURCES: 'Recurso',
    SKILLS: 'Pericia',
    ITEMS: 'Item',
    WEAPONS: 'Arma',
    TRAITS: 'Traco/talento',
    POWERS: 'Poder',
    CONDITIONS: 'Condicao',
    ROLLS: 'Rolagem',
    CUSTOM: 'Registro'
  }
  return labels[type] || 'Sistema'
}

function classAddForField(schema: SystemSchema | undefined, classKey: string, level: number, fieldKey: string) {
  const classInfo = schema?.classes?.find((item) => item.key === classKey)
  return (classInfo?.levels || [])
    .filter((item) => item.level <= level)
    .flatMap((item) => item.changes || [])
    .filter((change) => change.operation === 'ADD' && formulaKeyFromLabel(change.targetKey || '') === formulaKeyFromLabel(fieldKey))
    .reduce((sum, change) => sum + numberValue(change.value), 0)
}

function validateFormula(expression: unknown, values: Map<string, unknown>, label: string, errors: string[]) {
  if (!expression || typeof expression !== 'string') return
  const { missing } = resolveFormulaExpression(expression, new Map([...values.entries()].map(([key, value]) => [key, String(value)])))
  if (missing) errors.push(`${label}: chave "${missing}" nao existe no sistema.`)
}

function registerKey(keys: Map<string, string>, key: string, label: string, errors: string[]) {
  if (!key) return
  const previous = keys.get(key)
  if (previous) errors.push(`Chave "${key}" duplicada em ${previous} e ${label}.`)
  keys.set(key, label)
}

function clampInt(value: unknown, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(Number(value || 0))))
}

function numberValue(value: unknown) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function extractSignedNumber(value: unknown) {
  const match = String(value || '').match(/[+-]?\d+/)
  return match ? Number(match[0]) : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
