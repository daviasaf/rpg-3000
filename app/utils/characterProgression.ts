import type { DynamicField, SystemClass, SystemClassLevelChange, SystemSchema } from '../../shared/types/system'

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
}

function numberValue(value: unknown) {
  return Number(value || 0)
}

export function getProgressionContext(schema: SystemSchema | undefined, dataJson: Record<string, unknown>): ProgressionContext {
  const classKey = String(dataJson.classe || '')
  const level = Math.max(1, Number(dataJson.nivel || 1))
  const classInfo = schema?.classes?.find((item) => item.key === classKey)
  const activeChanges = classInfo
    ? classInfo.levels
      .filter((item) => item.level <= level)
      .flatMap((item) => item.changes.map((change) => ({ ...change, level: item.level })))
    : []

  return { classKey, level, classInfo, activeChanges }
}

export function applyClassProgression(schema: SystemSchema | undefined, dataJson: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...dataJson }
  const context = getProgressionContext(schema, next)

  if (!context.classInfo) return next

  next.classe = context.classInfo.key
  next.nivel = Math.max(1, Math.min(context.level, context.classInfo.maxLevel))

  for (const change of context.activeChanges) {
    if (change.operation === 'NOTE' || !change.targetKey) continue
    if (change.operation === 'SET') {
      next[change.targetKey] = numberValue(change.value)
    } else {
      next[change.targetKey] = numberValue(next[change.targetKey]) + numberValue(change.value)
    }
  }

  return next
}

export function classNotes(schema: SystemSchema | undefined, dataJson: Record<string, unknown>) {
  const context = getProgressionContext(schema, dataJson)
  return context.activeChanges
    .filter((change) => change.operation === 'NOTE' && change.note?.trim())
    .map((change) => ({
      level: change.level,
      title: context.classInfo?.name || context.classKey || 'Classe',
      note: change.note!.trim()
    }))
}

export function fieldSources(field: DynamicField, schema: SystemSchema | undefined, dataJson: Record<string, unknown>): FieldSource[] {
  const context = getProgressionContext(schema, dataJson)
  const finalValue = dataJson[field.key]
  const changes = context.activeChanges.filter((change) => change.targetKey === field.key && change.operation !== 'NOTE')

  if (!changes.length) {
    return [{ label: 'Personagem', value: finalValue ?? field.defaultValue ?? '' }]
  }

  const addTotal = changes
    .filter((change) => change.operation === 'ADD')
    .reduce((sum, change) => sum + numberValue(change.value), 0)
  const lastSet = [...changes].reverse().find((change) => change.operation === 'SET')
  const baseValue = lastSet ? 'substituido pela classe' : numberValue(finalValue) - addTotal

  return [
    { label: 'Personagem', value: baseValue },
    ...changes.map((change) => ({
      label: `${context.classInfo?.name || context.classKey || 'Classe'} nivel ${change.level}`,
      value: change.operation === 'SET' ? `define ${numberValue(change.value)}` : `+${numberValue(change.value)}`,
      note: change.note
    }))
  ]
}
