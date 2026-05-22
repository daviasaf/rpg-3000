import type { DynamicField, RuleEffect, SheetTab, SheetTabRecord, SheetTabType, SystemLevelRule, SystemSchema } from '../types/system'
import { formulaKeyFromLabel, normalizeEffects, normalizeSheetTabs } from './sheetTabs'

const selectableTypes: SheetTabType[] = ['SKILLS', 'ITEMS', 'WEAPONS', 'TRAITS', 'POWERS']

export type RuleTotals = {
  level: number
  attributeBudget: number
  attributePoints: number
  attributePointChoices: number
  skillChoices: number
  powerChoices: number
  traitChoices: number
  itemChoices: number
  weaponChoices: number
  inventoryCapacity: number
  damageReceivedFlat: number
  damageReceivedMultiplier: number
}

export type FormulaVariable = {
  key: string
  label: string
  type: string
}

export type FormulaResolveResult = {
  resolved: string
  missing: string
}

export function initialLevelForSchema(schema: SystemSchema | undefined) {
  const levels = normalizedLevelProgression(schema).map((item) => item.level)
  if (levels.includes(0)) return 0
  if (Number.isFinite(Number(schema?.leveling?.initialLevel))) return clampInt(schema?.leveling?.initialLevel, 0, 100)
  return Math.min(...levels, 1)
}

export function normalizedLevelProgression(schema: SystemSchema | undefined): SystemLevelRule[] {
  const legacy = schema?.leveling
  const rules = schema?.levelProgression?.length
    ? schema.levelProgression
    : [{
        level: 0,
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

  const normalized = rules
    .map((rule, index) => ({
      ...rule,
      id: rule.id || `level_rule_${index}`,
      level: clampInt(rule.level ?? index, 0, 100),
      attributeBudget: clampInt(rule.attributeBudget ?? (Number(rule.level ?? index) <= 0 ? legacy?.levelOneAttributePoints ?? rule.attributePoints ?? 6 : legacy?.attributesPerLevel ?? rule.attributePoints ?? 0), 0, 200),
      attributePoints: clampInt(rule.attributePoints ?? (Number(rule.level ?? index) <= 0 ? legacy?.levelOneAttributeLimit ?? 5 : (legacy?.levelOneAttributeLimit ?? 5) + Math.max(0, Number(rule.level || 1)) * (legacy?.attributeLimitIncreasePerLevel ?? 1)), 0, 200),
      skillChoices: clampInt(rule.skillChoices, 0, 100),
      powerChoices: clampInt(rule.powerChoices, 0, 100),
      traitChoices: clampInt(rule.traitChoices, 0, 100),
      itemChoices: clampInt(rule.itemChoices, 0, 100),
      weaponChoices: clampInt(rule.weaponChoices, 0, 100),
      inventoryCapacity: clampInt(rule.inventoryCapacity, 0, 10000),
      resourceGains: rule.resourceGains || [],
      bonusGains: rule.bonusGains || [],
      effects: normalizeEffects(rule.effects),
      tables: rule.tables || [],
      notes: rule.notes || ''
    }))
    .sort((a, b) => a.level - b.level)

  if (!normalized.some((rule) => rule.level === 0)) {
    const first = normalized[0]
    normalized.unshift({
      id: 'level_rule_0',
      level: 0,
      attributeBudget: Number(first?.attributeBudget ?? legacy?.levelOneAttributePoints ?? 6),
      attributePoints: Number(first?.attributePoints ?? legacy?.levelOneAttributeLimit ?? 5),
      skillChoices: 0,
      powerChoices: 0,
      traitChoices: 0,
      itemChoices: 0,
      weaponChoices: 0,
      inventoryCapacity: Number(first?.inventoryCapacity ?? 0),
      resourceGains: [],
      bonusGains: [],
      effects: [],
      notes: 'Base inicial do personagem.'
    })
  }

  return normalized
}

export function progressionTotals(schema: SystemSchema | undefined, levelValue: unknown, classKeyValue?: unknown): RuleTotals {
  const minLevel = initialLevelForSchema(schema)
  const level = clampInt(levelValue ?? minLevel, minLevel, 100)
  const totals: RuleTotals = {
    level,
    attributeBudget: 0,
    attributePoints: 0,
    attributePointChoices: 0,
    skillChoices: 0,
    powerChoices: 0,
    traitChoices: 0,
    itemChoices: 0,
    weaponChoices: 0,
    inventoryCapacity: 0,
    damageReceivedFlat: 0,
    damageReceivedMultiplier: 1
  }

  for (const rule of normalizedLevelProgression(schema).filter((item) => item.level <= level)) {
    totals.attributeBudget = Number(rule.attributeBudget ?? totals.attributeBudget)
    totals.attributePoints = Number(rule.attributePoints ?? totals.attributePoints)
    totals.skillChoices += Number(rule.skillChoices || 0)
    totals.powerChoices += Number(rule.powerChoices || 0)
    totals.traitChoices += Number(rule.traitChoices || 0)
    totals.itemChoices += Number(rule.itemChoices || 0)
    totals.weaponChoices += Number(rule.weaponChoices || 0)
    totals.inventoryCapacity = Math.max(totals.inventoryCapacity, Number(rule.inventoryCapacity || 0))
    applyEffectsToTotals(totals, rule.effects || [])
  }

  const classInfo = schema?.classes?.find((item) => item.key === String(classKeyValue || ''))
  for (const classLevel of classInfo?.levels?.filter((item) => item.level <= level) || []) {
    totals.skillChoices += Number(classLevel.skillChoices || 0)
    totals.powerChoices += Number(classLevel.powerChoices || 0)
    totals.traitChoices += Number(classLevel.traitChoices || 0)
    totals.itemChoices += Number(classLevel.itemChoices || 0)
    totals.weaponChoices += Number(classLevel.weaponChoices || 0)
    totals.attributePointChoices += Number(classLevel.attributePoints || 0)
    totals.inventoryCapacity = Math.max(totals.inventoryCapacity, Number(classLevel.inventoryCapacity || 0))
    for (const change of classLevel.changes || []) {
      if (change.type === 'ATTRIBUTE_POINT') totals.attributePointChoices += Number(change.choiceCount ?? change.value ?? 1)
    }
  }

  return totals
}

function applyEffectsToTotals(totals: RuleTotals, effects: RuleEffect[]) {
  for (const effect of effects || []) {
    const value = numberValue(effect.value)
    if (effect.type === 'ATTRIBUTE_POINT') totals.attributePointChoices += Number(effect.choiceCount ?? value ?? 1)
    if (effect.type === 'SKILL' && effect.operation === 'CHOICE') totals.skillChoices += Number(effect.choiceCount ?? value ?? 1)
    if (effect.type === 'POWER' && effect.operation === 'CHOICE') totals.powerChoices += Number(effect.choiceCount ?? value ?? 1)
    if (effect.type === 'TRAIT' && effect.operation === 'CHOICE') totals.traitChoices += Number(effect.choiceCount ?? value ?? 1)
    if (effect.type === 'ITEM' && effect.operation === 'CHOICE') totals.itemChoices += Number(effect.choiceCount ?? value ?? 1)
    if (effect.type === 'WEAPON' && effect.operation === 'CHOICE') totals.weaponChoices += Number(effect.choiceCount ?? value ?? 1)
    if (effect.type === 'DAMAGE_RECEIVED') {
      if (effect.operation === 'HALVE') totals.damageReceivedMultiplier *= 0.5
      else if (effect.operation === 'MULTIPLY') totals.damageReceivedMultiplier *= Number(effect.value || 1)
      else if (effect.operation === 'SUBTRACT') totals.damageReceivedFlat -= value
      else totals.damageReceivedFlat += value
    }
  }
}

export function validateSystemRules(schema: SystemSchema | undefined, fields: DynamicField[] = []) {
  const errors: string[] = []
  const keys = buildSystemKeyMap(schema, fields, errors)

  for (const field of fields) {
    validateFormula(field.formula, keys, `${field.label}: formula`, errors)
    if (field.defaultValue !== undefined) validateFormulaLikeValue(field.defaultValue, keys, `${field.label}: valor padrao`, errors)
  }

  for (const tab of normalizeSheetTabs(schema)) {
    for (const table of tab.tables || []) validateTable(table.rows, `${tab.name}: tabela`, errors)
    for (const record of tab.records || []) {
      validateFormula(record.roll, keys, `${record.name}: rolagem`, errors)
      validateFormula(record.damage, keys, `${record.name}: dano`, errors)
      validateFormula(record.bonus, keys, `${record.name}: bonus legado`, errors)
      validateFormulaLikeValue(record.value, keys, `${record.name}: valor padrao`, errors)
      validateFormulaLikeValue(record.max, keys, `${record.name}: maximo`, errors)
      validateEffectList(record.effects || [], keys, `${record.name}: modificacao`, errors)
      for (const level of record.levels || []) validateEffectList(level.effects || [], keys, `${record.name} nivel ${level.level}`, errors)
      for (const table of record.tables || []) validateTable(table.rows, `${record.name}: tabela`, errors)
    }
  }

  for (const rule of normalizedLevelProgression(schema)) validateEffectList(rule.effects || [], keys, `Nivel ${rule.level}`, errors)
  for (const rpgClass of schema?.classes || []) {
    const classLevels = new Set<number>()
    for (const level of rpgClass.levels || []) {
      if (classLevels.has(level.level)) errors.push(`${rpgClass.name}: nivel ${level.level} duplicado.`)
      classLevels.add(level.level)
      for (const change of level.changes || []) {
        if (change.operation !== 'NOTE' && change.type !== 'ATTRIBUTE_POINT' && change.type !== 'DAMAGE_RECEIVED' && change.targetKey && !keys.has(formulaKeyFromLabel(change.targetKey))) {
          errors.push(`${rpgClass.name} nivel ${level.level}: alvo "${change.targetKey}" nao existe no sistema.`)
        }
      }
    }
  }
  return errors
}

function buildSystemKeyMap(schema: SystemSchema | undefined, fields: DynamicField[], errors: string[] = []) {
  const keys = new Map<string, string>()
  registerKey(keys, 'NIVEL', 'Nivel do personagem', errors)
  registerKey(keys, 'DANO_RECEBIDO', 'Dano recebido', errors)

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
    }
  }

  return keys
}

export function validateCharacterData(schema: SystemSchema | undefined, fields: DynamicField[] = [], dataJson: Record<string, unknown> = {}) {
  const errors: string[] = []
  const tabs = normalizeSheetTabs(schema)
  const classKey = String(dataJson.classe || '')
  const classInfo = schema?.classes?.find((item) => item.key === classKey)
  const minLevel = initialLevelForSchema(schema)
  const level = clampInt(dataJson.nivel ?? minLevel, minLevel, classInfo?.maxLevel || 100)
  const totals = progressionTotals(schema, level, classKey)
  const attributeFields = fields.filter((field) => field.category === 'ATTRIBUTE')
  const attributeLimit = attributeLimitForLevel(schema, level)
  let spentAttributes = 0

  for (const field of attributeFields) {
    const value = numberValue(dataJson[field.key])
    const baseValue = value - classAddForField(schema, classKey, level, field.key)
    if (baseValue < 0 || baseValue > attributeLimit) errors.push(`${field.label}: valor fora do limite 0-${attributeLimit}.`)
    spentAttributes += Math.max(0, baseValue)
  }
  if (attributeFields.length && spentAttributes > totals.attributeBudget + totals.attributePointChoices) {
    errors.push(`Atributos acima dos pontos disponiveis: ${spentAttributes}/${totals.attributeBudget + totals.attributePointChoices}.`)
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
  values.set('DANO_RECEBIDO', String(resolveDamageReceivedValue(totals)))
  for (const tab of tabs) {
    for (const record of tab.records || []) {
      validateFormula(record.roll, values, `${record.name}: rolagem`, errors)
      validateFormula(record.damage, values, `${record.name}: dano`, errors)
      validateFormula(record.bonus, values, `${record.name}: bonus legado`, errors)
      validateFormulaLikeValue(record.value, values, `${record.name}: valor padrao`, errors)
      validateFormulaLikeValue(record.max, values, `${record.name}: maximo`, errors)
    }
  }

  return errors
}

function resolveDamageReceivedValue(totals: RuleTotals) {
  return totals.damageReceivedFlat * totals.damageReceivedMultiplier
}

export function formulaValues(fields: DynamicField[] = [], tabs: SheetTab[] = [], dataJson: Record<string, unknown> = {}) {
  const values = new Map<string, string>()
  values.set('NIVEL', String(numberValue(dataJson.nivel ?? 0)))
  values.set('DANO_RECEBIDO', String(numberValue(dataJson.DANO_RECEBIDO)))
  for (const field of fields) values.set(formulaKeyFromLabel(field.key), String(numberValue(dataJson[field.key] ?? field.defaultValue ?? 0)))
  for (const tab of tabs) {
    const nested = isRecord(dataJson[tab.key]) ? dataJson[tab.key] as Record<string, unknown> : {}
    for (const record of tab.records || []) {
      const key = formulaKeyFromLabel(record.key || record.name)
      const nestedRecord = nested[key] ?? nested[record.key || '']
      const nestedValue = isRecord(nestedRecord) ? (nestedRecord as Record<string, unknown>).value ?? (nestedRecord as Record<string, unknown>).current : nestedRecord
      values.set(key, String(numberValue(dataJson[key] ?? nestedValue ?? resolveNumericDefault(record.value, values) ?? 0)))
    }
  }
  return values
}

export function resolveNumericDefault(value: unknown, values: Map<string, string>) {
  if (value === undefined || value === null || value === '') return 0
  if (Number.isFinite(Number(value))) return Number(value)
  const expression = String(value)
  const { resolved, missing } = resolveFormulaExpression(expression, values)
  if (missing) return 0
  return safeMathNumber(resolved)
}

export function formulaVariableList(schema: SystemSchema | undefined, fields: DynamicField[] = []): FormulaVariable[] {
  const variables: FormulaVariable[] = [
    { key: 'NIVEL', label: 'Nivel do personagem', type: 'Sistema' },
    { key: 'DANO_RECEBIDO', label: 'Modificador de dano recebido', type: 'Combate' }
  ]
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
  const variables: FormulaVariable[] = [
    { key: 'NIVEL', label: 'Nivel do personagem', type: 'Sistema' },
    { key: 'DANO_RECEBIDO', label: 'Modificador de dano recebido', type: 'Combate' }
  ]
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
      }
      continue
    }

    for (const record of tab.records || []) {
      if (!['ATTRIBUTES', 'RESOURCES', 'ROLLS'].includes(tab.type)) continue
      variables.push({ key: formulaKeyFromLabel(record.key || record.name), label: record.name, type: formulaTabType(tab.type) })
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

export function resolveFormulaExpression(expression: string, values: Map<string, string>): FormulaResolveResult {
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
  if (type === 'ITEMS') return totals.itemChoices > 0 ? totals.itemChoices : Number.POSITIVE_INFINITY
  if (type === 'WEAPONS') return totals.weaponChoices > 0 ? totals.weaponChoices : Number.POSITIVE_INFINITY
  if (type === 'TRAITS') return totals.traitChoices > 0 ? totals.traitChoices : 1
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
  const increase = Math.max(0, level) * Number(leveling?.attributeLimitIncreasePerLevel ?? 0)
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
    .filter((change) => ['ADD', 'SUBTRACT'].includes(change.operation) && formulaKeyFromLabel(change.targetKey || '') === formulaKeyFromLabel(fieldKey))
    .reduce((sum, change) => sum + (change.operation === 'SUBTRACT' ? -numberValue(change.value) : numberValue(change.value)), 0)
}

function validateFormula(expression: unknown, values: Map<string, unknown>, label: string, errors: string[]) {
  if (!expression || typeof expression !== 'string') return
  const { missing } = resolveFormulaExpression(expression, new Map([...values.entries()].map(([key, value]) => [key, String(value)])))
  if (missing) errors.push(`${label}: chave "${missing}" nao existe no sistema.`)
}

function validateFormulaLikeValue(value: unknown, values: Map<string, unknown>, label: string, errors: string[]) {
  if (typeof value !== 'string') return
  if (!/[A-Za-z_]/.test(value)) return
  validateFormula(value, values, label, errors)
}

function validateEffectList(effects: RuleEffect[], keys: Map<string, unknown>, label: string, errors: string[]) {
  for (const effect of effects || []) {
    if (effect.operation !== 'NOTE' && effect.operation !== 'CHOICE' && effect.type !== 'ATTRIBUTE_POINT' && effect.type !== 'DAMAGE_RECEIVED') {
      const target = formulaKeyFromLabel(effect.targetKey || '')
      if (!target || !keys.has(target)) errors.push(`${label}: alvo "${effect.targetLabel || effect.targetKey || 'sem alvo'}" nao existe no sistema.`)
    }
    validateFormulaLikeValue(effect.value, keys, `${label}: valor`, errors)
  }
}

function validateTable(rows: string[][] | undefined, label: string, errors: string[]) {
  if (!rows?.length) return
  const width = rows[0]?.length || 0
  if (width < 1) errors.push(`${label}: tabela sem colunas.`)
  for (const row of rows) {
    if (row.length !== width) errors.push(`${label}: linhas com tamanhos diferentes.`)
  }
}

function registerKey(keys: Map<string, string>, key: string, label: string, errors: string[]) {
  if (!key) return
  const clean = formulaKeyFromLabel(key)
  const previous = keys.get(clean)
  if (previous) errors.push(`Chave "${clean}" duplicada em ${previous} e ${label}.`)
  keys.set(clean, label)
}

function clampInt(value: unknown, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(Number(value ?? 0))))
}

function numberValue(value: unknown) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function safeMathNumber(expression: string) {
  if (!/^[\d+\-*/().\s]+$/.test(expression)) return 0
  try {
    const result = Function(`"use strict"; return (${expression})`)() as unknown
    return Number.isFinite(Number(result)) ? Number(result) : 0
  } catch {
    return 0
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
