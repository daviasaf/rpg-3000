<script setup lang="ts">
import type { DynamicField, SystemSchema } from '../../shared/types/system'
import { normalizedLevelProgression } from '~~/shared/utils/characterRules'
import { normalizeSheetTabs, sheetTabTypeLabels } from '~~/shared/utils/sheetTabs'

const props = withDefaults(defineProps<{
  schema?: SystemSchema | null
  fields?: DynamicField[]
  compact?: boolean
}>(), {
  schema: null,
  fields: () => [],
  compact: false
})

const tabs = computed(() => normalizeSheetTabs(props.schema || undefined))
const levels = computed(() => normalizedLevelProgression(props.schema || undefined))
const fieldGroups = computed(() => {
  const order = ['ATTRIBUTE', 'RESOURCE', 'SKILL', 'ROLL_RULE', 'FORMULA', 'TEXT_FIELD', 'NUMERIC_FIELD', 'BOOLEAN_FIELD', 'LIST_FIELD', 'STATUS_BAR']
  return order
    .map((category) => ({ category, fields: props.fields.filter((field) => field.category === category) }))
    .filter((group) => group.fields.length)
})

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    ATTRIBUTE: 'Atributos',
    RESOURCE: 'Recursos',
    SKILL: 'Pericias',
    ROLL_RULE: 'Rolagens',
    FORMULA: 'Formulas',
    TEXT_FIELD: 'Textos',
    NUMERIC_FIELD: 'Numeros',
    BOOLEAN_FIELD: 'Marcadores',
    LIST_FIELD: 'Listas',
    STATUS_BAR: 'Estado'
  }
  return labels[category] || category
}
</script>

<template>
  <div class="space-y-4">
    <section v-if="levels.length" class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="font-black text-white">Progressao de nivel</h3>
        <span class="kbd-chip">{{ levels.length }} niveis</span>
      </div>
      <div class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="level in levels.slice(0, compact ? 3 : levels.length)" :key="level.id || level.level" class="rounded-lg border border-white/10 bg-panel/60 p-3 text-sm">
          <b class="text-white">Nivel {{ level.level }}</b>
          <p class="mt-1 text-mist">Pontos: {{ level.attributeBudget ?? 0 }} | Max/atributo: {{ level.attributePoints ?? 0 }}</p>
          <p v-if="level.skillChoices" class="text-mist">Pericias: {{ level.skillChoices }}</p>
          <p v-if="level.powerChoices" class="text-mist">Poderes: {{ level.powerChoices }}</p>
          <p v-if="level.inventoryCapacity" class="text-mist">Peso: {{ level.inventoryCapacity }}</p>
          <p v-if="level.notes" class="mt-2 line-clamp-2 text-xs leading-5 text-mist">{{ level.notes }}</p>
        </div>
      </div>
    </section>

    <section v-if="tabs.length" class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="font-black text-white">Abas da ficha</h3>
        <span class="kbd-chip">{{ tabs.length }}</span>
      </div>
      <div class="mt-3 grid gap-2 md:grid-cols-2">
        <div v-for="tab in tabs" :key="tab.id || tab.key" class="rounded-lg border border-white/10 bg-panel/60 p-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <b class="text-white">{{ tab.name }}</b>
              <p class="text-xs text-mist">{{ sheetTabTypeLabels[tab.type] }} | {{ tab.records?.length || 0 }} registros</p>
            </div>
            <span v-if="tab.readonly" class="kbd-chip">Leitura</span>
          </div>
          <div v-if="tab.records?.length" class="mt-2 flex flex-wrap gap-1.5">
            <span v-for="record in tab.records.slice(0, compact ? 4 : 12)" :key="record.id || record.key || record.name" class="rounded-md border border-white/10 px-2 py-1 text-[11px] font-bold text-mist">
              {{ record.name }}<span v-if="record.weight"> | peso {{ record.weight }}</span>
            </span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="fieldGroups.length" class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <h3 class="font-black text-white">Campos gerados</h3>
      <div class="mt-3 grid gap-2 md:grid-cols-2">
        <div v-for="group in fieldGroups" :key="group.category" class="rounded-lg border border-white/10 bg-panel/60 p-3">
          <b class="text-white">{{ categoryLabel(group.category) }}</b>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <span v-for="field in group.fields.slice(0, compact ? 4 : 10)" :key="field.key" class="rounded-md border border-white/10 px-2 py-1 text-[11px] font-bold text-mist">
              {{ field.label }} | {{ field.key }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <EmptyState v-if="!levels.length && !tabs.length && !fieldGroups.length" title="Sistema sem estrutura" description="Nao ha campos, abas ou progressao configurados." />
  </div>
</template>
