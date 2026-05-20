<script setup lang="ts">
import { ChevronDown, Save } from 'lucide-vue-next'
import type { DynamicField, SystemSchema } from '../../shared/types/system'

const props = defineProps<{
  character: {
    id: string
    name: string
    description?: string | null
    avatarUrl?: string | null
    dataJson: Record<string, unknown>
    system: { name: string; schemaJson?: SystemSchema; fields: DynamicField[] }
  }
  roomId?: string
  editable?: boolean
  autosave?: boolean
}>()

const emit = defineEmits<{ saved: [] }>()
const { push, apiError } = useToast()
const draft = reactive<Record<string, unknown>>({ ...props.character.dataJson })
const saving = ref(false)
const openGroups = ref(new Set<string>())
const savedAt = ref<Date | null>(null)
const autosaveReady = ref(false)
const syncing = ref(false)
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
const className = computed(() => {
  const classKey = String(props.character.dataJson.classe || '')
  if (!classKey) return ''
  return props.character.system.schemaJson?.classes?.find((item) => item.key === classKey)?.name || classKey
})

const groups = computed(() => {
  const order = ['ATTRIBUTE', 'RESOURCE', 'SKILL', 'TEXT_FIELD', 'NUMERIC_FIELD', 'BOOLEAN_FIELD', 'LIST_FIELD', 'FORMULA', 'ROLL_RULE', 'STATUS_BAR']
  return order
    .map((category) => ({
      category,
      fields: props.character.system.fields.filter((field) => field.category === category)
    }))
    .filter((group) => group.fields.length > 0)
})

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    ATTRIBUTE: 'Atributos',
    RESOURCE: 'Recursos',
    SKILL: 'Pericias',
    TEXT_FIELD: 'Informacoes',
    NUMERIC_FIELD: 'Numeros',
    BOOLEAN_FIELD: 'Marcadores',
    LIST_FIELD: 'Listas',
    FORMULA: 'Formulas',
    ROLL_RULE: 'Rolagens',
    STATUS_BAR: 'Estado'
  }
  return labels[category] || category
}

function isGroupOpen(category: string) {
  return openGroups.value.has(category)
}

function toggleGroup(category: string) {
  const next = new Set(openGroups.value)
  if (next.has(category)) next.delete(category)
  else next.add(category)
  openGroups.value = next
}

async function save(silent = false) {
  if (!props.editable) return
  saving.value = true
  try {
    const payload = { ...draft }
    await $fetch(`/api/characters/${props.character.id}`, {
      method: 'PUT',
      body: { dataJson: payload }
    })
    savedAt.value = new Date()
    if (!silent) push('Ficha salva.', 'success')
    emit('saved')
  } catch (error) {
    apiError(error, 'Nao foi possivel salvar a ficha.')
  } finally {
    saving.value = false
  }
}

watch(() => props.character.dataJson, (next) => {
  syncing.value = true
  for (const key of Object.keys(draft)) {
    if (!(key in next)) delete draft[key]
  }
  Object.assign(draft, next)
  nextTick(() => {
    syncing.value = false
  })
}, { deep: true })

watch(draft, () => {
  if (!props.autosave || !props.editable || !autosaveReady.value || syncing.value) return
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => save(true), 650)
}, { deep: true })

onMounted(() => {
  autosaveReady.value = true
})

onBeforeUnmount(() => {
  if (autosaveTimer) clearTimeout(autosaveTimer)
})
</script>

<template>
  <div class="grid gap-5 lg:grid-cols-[280px_1fr]">
    <AppCard>
      <div class="aspect-square overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-ember/20 to-arcane/20">
        <img v-if="character.avatarUrl" :src="character.avatarUrl" :alt="character.name" class="h-full w-full object-cover">
        <AppAvatar v-else :name="character.name" size="xl" />
      </div>
      <span class="mt-4 inline-flex rounded-md border border-ember/25 bg-ember/10 px-2 py-0.5 text-[11px] font-bold text-ember">{{ character.system.name }}</span>
      <h1 class="mt-2 text-3xl font-black text-white">{{ character.name }}</h1>
      <p v-if="className" class="mt-1 text-sm font-bold text-ember">{{ className }} nivel {{ character.dataJson.nivel || 1 }}</p>
      <p class="mt-2 text-sm leading-6 text-mist">{{ character.description || 'Sem descricao.' }}</p>
      <AppButton v-if="editable" class="mt-5 w-full" :loading="saving" @click="save()"><Save class="h-4 w-4" />Salvar ficha</AppButton>
      <p v-if="editable && savedAt" class="mt-3 text-xs font-bold text-mist">
        Salva as {{ savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}
      </p>
    </AppCard>

    <div class="space-y-5">
      <AppCard v-for="group in groups" :key="group.category">
        <button type="button" class="flex w-full items-center justify-between gap-3 text-left" @click="toggleGroup(group.category)">
          <h2 class="text-lg font-black text-white">{{ categoryLabel(group.category) }}</h2>
          <ChevronDown class="h-5 w-5 text-ember transition" :class="isGroupOpen(group.category) ? 'rotate-180' : ''" />
        </button>
        <div v-if="isGroupOpen(group.category)" class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="field in group.fields" :key="field.key" class="relative" :class="field.type === 'TEXT' ? 'md:col-span-2 xl:col-span-3' : ''">
            <DynamicFieldRenderer v-model="draft[field.key]" :field="field" :readonly="!editable" />
          </div>
        </div>
      </AppCard>
    </div>
  </div>
</template>
