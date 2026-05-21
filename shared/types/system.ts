export type FieldType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'LIST' | 'FORMULA' | 'DICE'

export type FieldCategory =
  | 'ATTRIBUTE'
  | 'SKILL'
  | 'RESOURCE'
  | 'STATUS_BAR'
  | 'TEXT_FIELD'
  | 'NUMERIC_FIELD'
  | 'BOOLEAN_FIELD'
  | 'LIST_FIELD'
  | 'FORMULA'
  | 'ROLL_RULE'

export interface DynamicField {
  id?: string
  key: string
  label: string
  type: FieldType
  category: FieldCategory
  defaultValue?: unknown
  optionsJson?: unknown
  formula?: string | null
  order?: number
}

export interface SystemSchema {
  primaryResource?: string
  defaultRoll?: string
  notes?: string
  categories?: string[]
  leveling?: {
    attributesPerLevel?: number
    levelOneAttributeLimit?: number
    attributeLimitIncreasePerLevel?: number
    maxAttributeLimit?: number
    levelOneAttributePoints?: number
  }
  classes?: SystemClass[]
}

export interface SystemClassLevelChange {
  targetKey?: string
  targetLabel?: string
  operation: 'ADD' | 'SET' | 'NOTE'
  value?: number
  note?: string
}

export interface SystemClassLevel {
  level: number
  changes: SystemClassLevelChange[]
}

export interface SystemClass {
  id?: string
  key: string
  name: string
  description?: string
  maxLevel: number
  levels: SystemClassLevel[]
}

export interface DiceResult {
  expression: string
  result: number
  rolls: Array<{ count: number; sides: number; values: number[]; subtotal: number }>
  modifier: number
  mode: string
}
