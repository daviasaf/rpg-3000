import type { DynamicField, RuleEffect, SheetTab, SheetTabRecord, SystemClass, SystemClassLevelChange, SystemSchema } from '../../shared/types/system'
import { formulaKeyFromLabel, normalizeSheetTabs } from '../../shared/utils/sheetTabs'
import { initialLevelForSchema, progressionTotals, resolveNumericDefault } from '../../shared/utils/characterRules'

export type FieldSource = {
  label: string
  value: unknown
  note?: string
}

export type ProgressionContext = {
  classKey: string
  level: number
  classInfo?: SystemClass
  activeChanges: Array<SystemClassLevelChange & { level: number }>
  activeEffects: Array<RuleEffect & { level?: number; sourceLabel: string; multiplier?: number }>
}

function numberValue(value: unknown) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function applyNumericOperation(current: unknown, operation: string | undefined, value: number) {
  const base = numberValue(current)
  if (operation === 'SET') return value
  if (operation === 'SUBTRACT') return base - value
  if (operation === 'MULTIPLY') return base * value
  return base + value
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : `${value}`
}

function normalizeKey(value: unknown) {
  return formulaKeyFromLabel(String(value || ''))
}

export function getProgressionContext(schema: SystemSchema | undefined, dataJson: Record<string, unknown>): ProgressionContext {
  const classKey = String(dataJson.classe || '')
  const minLevel = initialLevelForSchema(schema)
  const level = Math.max(minLevel, Number(dataJson.nivel ?? minLevel))
  const classInfo = schema?.classes?.find((item) => item.key === classKey)
  const activeChanges = classInfo
    ? classInfo.levels
      .filter((item) => item.level <= level)
      .flatMap((item) => item.changes.map((change) => ({ ...change, level: item.level })))
    : []

  const activeEffects = collectEffects(schema, dataJson, level)

  return { classKey, level, classInfo, activeChanges, activeEffects }
}

export function applyClassProgression(schema: SystemSchema | undefined, dataJson: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...dataJson }
  const context = getProgressionContext(schema, next)

  if (context.classInfo) {
    next.classe = context.classInfo.key
    next.nivel = Math.max(initialLevelForSchema(schema), Math.min(context.level, context.classInfo.maxLevel))
  } else {
    next.nivel = Math.max(initialLevelForSchema(schema), context.level)
  }

  for (const change of context.activeChanges) {
    if (change.operation === 'NOTE' || change.type === 'ATTRIBUTE_POINT' || !change.targetKey) continue
    const key = normalizeKey(change.targetKey)
    next[key] = applyNumericOperation(next[key], change.operation, numberValue(change.value))
  }

  for (const effect of context.activeEffects) {
    if (effect.operation === 'NOTE' || effect.operation === 'CHOICE' || effect.type === 'ATTRIBUTE_POINT' || effect.type === 'DAMAGE_RECEIVED' || !effect.targetKey) continue
    const key = normalizeKey(effect.targetKey)
    const rawValue = typeof effect.value === 'string' ? resolveNumericDefault(effect.value, valueMap(next)) : numberValue(effect.value)
    const value = effect.perPoint ? rawValue * Number(effect.multiplier || 1) : rawValue
    next[key] = applyNumericOperation(next[key], effect.operation, value)
  }

  const totals = progressionTotals(schema, next.nivel, next.classe)
  const damageFromChanges = numberValue(next.DANO_RECEBIDO)
  next.DANO_RECEBIDO = damageFromChanges + (totals.damageReceivedFlat * totals.damageReceivedMultiplier)
  next.__sources = buildSources(schema, dataJson, context)

  return next
}

export function classNotes(schema: SystemSchema | undefined, dataJson: Record<string, unknown>) {
  const context = getProgressionContext(schema, dataJson)
  const classNotes = context.activeChanges
    .filter((change) => change.operation === 'NOTE' && change.note?.trim())
    .map((change) => ({
      level: change.level,
      title: context.classInfo?.name || context.classKey || 'Classe',
      note: change.note!.trim()
    }))

  const effectNotes = context.activeEffects
    .filter((effect) => effect.operation === 'NOTE' && effect.note?.trim())
    .map((effect) => ({
      level: effect.level ?? 0,
      title: effect.sourceLabel,
      note: effect.note!.trim()
    }))

  return [...classNotes, ...effectNotes]
}

export function fieldSources(field: DynamicField, schema: SystemSchema | undefined, dataJson: Record<string, unknown>): FieldSource[] {
  const key = normalizeKey(field.key)
  const context = getProgressionContext(schema, dataJson)
  const finalValue = dataJson[key] ?? dataJson[field.key]
  const changes = context.activeChanges.filter((change) => normalizeKey(change.targetKey) === key && change.operation !== 'NOTE')
  const effects = context.activeEffects.filter((effect) => normalizeKey(effect.targetKey) === key && !['NOTE', 'CHOICE'].includes(effect.operation))

  if (!changes.length && !effects.length) {
    return [{ label: 'Personagem', value: finalValue ?? field.defaultValue ?? '' }]
  }

  const deltaTotal = [
    ...changes.filter((change) => change.operation === 'ADD').map((change) => numberValue(change.value)),
    ...changes.filter((change) => change.operation === 'SUBTRACT').map((change) => -numberValue(change.value)),
    ...effects.filter((effect) => effect.operation === 'ADD').map((effect) => numberValue(effect.value) * (effect.perPoint ? Number(effect.multiplier || 1) : 1)),
    ...effects.filter((effect) => effect.operation === 'SUBTRACT').map((effect) => -(numberValue(effect.value) * (effect.perPoint ? Number(effect.multiplier || 1) : 1)))
  ].reduce((sum, value) => sum + value, 0)
  const lastSet = [...changes, ...effects].reverse().find((change) => change.operation === 'SET')
  const baseValue = lastSet ? 'substituido por regra' : numberValue(finalValue) - deltaTotal

  return [
    { label: 'Base do personagem', value: baseValue },
    ...changes.map((change) => ({
      label: `${context.classInfo?.name || context.classKey || 'Classe'} nivel ${change.level}`,
      value: change.operation === 'SET' ? `define ${numberValue(change.value)}` : change.operation === 'SUBTRACT' ? `-${numberValue(change.value)}` : formatSigned(numberValue(change.value)),
      note: change.note
    })),
    ...effects.map((effect) => ({
      label: effect.sourceLabel,
      value: effect.operation === 'SET' ? `define ${effect.value}` : effect.operation === 'SUBTRACT' ? `-${numberValue(effect.value) * (effect.perPoint ? Number(effect.multiplier || 1) : 1)}` : formatSigned(numberValue(effect.value) * (effect.perPoint ? Number(effect.multiplier || 1) : 1)),
      note: effect.note || effect.condition
    }))
  ]
}

export function attributeEffectPreview(record: SheetTabRecord) {
  const levels = Number(record.max || 5)
  const effects = record.effects || []
  return Array.from({ length: Math.max(0, levels) }, (_, index) => {
    const level = index + 1
    return {
      level,
      effects: effects.map((effect) => ({
        ...effect,
        displayValue: effect.perPoint ? numberValue(effect.value) * level : effect.value
      }))
    }
  }).filter((item) => item.effects.length)
}

function collectEffects(schema: SystemSchema | undefined, dataJson: Record<string, unknown>, level: number) {
  const effects: Array<RuleEffect & { level?: number; sourceLabel: string; multiplier?: number }> = []
  const tabs = normalizeSheetTabs(schema)

  for (const rule of schema?.levelProgression || []) {
    if (Number(rule.level || 0) <= level) {
      for (const effect of rule.effects || []) effects.push({ ...effect, level: rule.level, sourceLabel: `Nivel ${rule.level}` })
    }
  }

  for (const tab of tabs) {
    for (const record of tab.records || []) {
      if (tab.type === 'ATTRIBUTES') {
        const points = numberValue(dataJson[normalizeKey(record.key || record.name)])
        if (points > 0) {
          for (const effect of record.effects || []) effects.push({ ...effect, sourceLabel: `${record.name} ${points}`, multiplier: points })
        }
      }
      if (isRecordSelected(tab, record, dataJson)) {
        for (const effect of record.effects || []) effects.push({ ...effect, sourceLabel: record.name })
        for (const recordLevel of record.levels || []) {
          const selectedLevel = selectedRecordLevel(tab, record, dataJson)
          if (Number(recordLevel.level || 0) <= selectedLevel) {
            for (const effect of recordLevel.effects || []) effects.push({ ...effect, level: recordLevel.level, sourceLabel: `${record.name} nivel ${recordLevel.level}` })
          }
        }
      }
    }
  }

  return effects
}

function isRecordSelected(tab: SheetTab, record: SheetTabRecord, dataJson: Record<string, unknown>) {
  const key = normalizeKey(record.key || record.name)
  if (['ITEMS', 'WEAPONS', 'TRAITS', 'POWERS', 'CONDITIONS', 'CUSTOM'].includes(tab.type)) {
    const list = Array.isArray(dataJson[tab.key]) ? dataJson[tab.key] as Array<Record<string, unknown>> : []
    return list.some((item) => normalizeKey(item.sourceRecordKey || item.key || item.name) === key)
  }
  if (tab.type === 'SKILLS') {
    const raw = dataJson[tab.key]
    return Boolean(raw && typeof raw === 'object' && !Array.isArray(raw) && (raw as Record<string, any>)[key]?.selected)
  }
  return ['ATTRIBUTES', 'RESOURCES', 'ROLLS'].includes(tab.type)
}

function selectedRecordLevel(tab: SheetTab, record: SheetTabRecord, dataJson: Record<string, unknown>) {
  const key = normalizeKey(record.key || record.name)
  if (Array.isArray(dataJson[tab.key])) {
    const item = (dataJson[tab.key] as Array<Record<string, unknown>>).find((entry) => normalizeKey(entry.sourceRecordKey || entry.key || entry.name) === key)
    return Number(item?.level || item?.recordLevel || 0)
  }
  const nested = dataJson[tab.key]
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const value = (nested as Record<string, Record<string, unknown>>)[key]
    return Number(value?.level || value?.recordLevel || 0)
  }
  return 0
}

function buildSources(schema: SystemSchema | undefined, originalData: Record<string, unknown>, context: ProgressionContext) {
  const sources: Record<string, FieldSource[]> = {}
  const tabs = normalizeSheetTabs(schema)
  const keys = new Set<string>()
  for (const tab of tabs) for (const record of tab.records || []) keys.add(normalizeKey(record.key || record.name))

  for (const key of keys) {
    const changes = context.activeChanges.filter((change) => normalizeKey(change.targetKey) === key && change.operation !== 'NOTE')
    const effects = context.activeEffects.filter((effect) => normalizeKey(effect.targetKey) === key && !['NOTE', 'CHOICE'].includes(effect.operation))
    if (!changes.length && !effects.length) continue
    sources[key] = [
      { label: 'Base', value: originalData[key] ?? 0 },
      ...changes.map((change) => ({ label: `Classe nivel ${change.level}`, value: change.operation === 'SUBTRACT' ? `-${change.value ?? 0}` : change.operation === 'SET' ? `define ${change.value ?? 0}` : formatSigned(numberValue(change.value)), note: change.note })),
      ...effects.map((effect) => ({ label: effect.sourceLabel, value: effect.operation === 'SUBTRACT' ? `-${effect.value ?? 0}` : effect.operation === 'SET' ? `define ${effect.value ?? 0}` : formatSigned(numberValue(effect.value)), note: effect.note || effect.condition }))
    ]
  }
  return sources
}

function valueMap(data: Record<string, unknown>) {
  return new Map(Object.entries(data).map(([key, value]) => [normalizeKey(key), String(numberValue(value))]))
}
