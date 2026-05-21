export type FieldType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'LIST' | 'FORMULA' | 'DICE'
export type SheetTabType =
  | 'ATTRIBUTES'
  | 'RESOURCES'
  | 'SKILLS'
  | 'CLASS_PROGRESS'
  | 'ITEMS'
  | 'WEAPONS'
  | 'TRAITS'
  | 'POWERS'
  | 'TEXT_BLOCKS'
  | 'CONDITIONS'
  | 'RULES'
  | 'ROLLS'
  | 'CUSTOM'

export type SheetFieldType =
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'CHECKBOX'
  | 'SELECT'
  | 'LIST'
  | 'DAMAGE'
  | 'ROLL'
  | 'COST'
  | 'RANGE'
  | 'BONUS'
  | 'IMAGE'
  | 'TAGS'
  | 'EXTRA_PAIR'

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

export interface SheetTabField {
  id?: string
  label: string
  key: string
  type: SheetFieldType
  required?: boolean
  defaultValue?: unknown
  options?: string[]
  placeholder?: string
  helpText?: string
  order?: number
}

export interface SheetTabRecord {
  id?: string
  name: string
  description?: string
  text?: string
  value?: number | string
  min?: number | null
  max?: number | null
  relatedAttribute?: string
  damage?: string
  roll?: string
  cost?: string
  range?: string
  ability?: string
  bonus?: string
  effect?: string
  quantity?: number | null
  fields?: Record<string, unknown>
  extraFields?: Array<{ id?: string; name: string; value: string }>
}

export interface SheetTab {
  id?: string
  name: string
  key: string
  type: SheetTabType
  description?: string
  order?: number
  enabled?: boolean
  readonly?: boolean
  playerEditable?: boolean
  allowMultiple?: boolean
  allowExtraFields?: boolean
  allowRolls?: boolean
  allowBonuses?: boolean
  allowDamageCostAbility?: boolean
  textMode?: 'SINGLE' | 'LIST'
  fields?: SheetTabField[]
  records?: SheetTabRecord[]
  systemMarkdown?: string
}

export interface SystemSchema {
  primaryResource?: string
  defaultRoll?: string
  notes?: string
  categories?: string[]
  rulesMarkdown?: string
  sheetSections?: Array<{
    id?: string
    key: string
    title: string
    enabled?: boolean
    multiple?: boolean
    longText?: boolean
    allowDamage?: boolean
    allowSkill?: boolean
    allowExtras?: boolean
  }>
  sheetTexts?: Array<{
    id?: string
    name: string
    text: string
  }>
  sheetLists?: Array<{
    id?: string
    key: string
    name: string
    description?: string
    enabled?: boolean
    allowDamage?: boolean
    allowSkill?: boolean
    allowExtras?: boolean
  }>
  sheetTabs?: SheetTab[]
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
