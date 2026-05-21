<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import type { DynamicField, SystemSchema } from '../../shared/types/system'

const props = defineProps<{
  character: {
    id: string
    name: string
    description?: string | null
    avatarUrl?: string | null
    moderationStatus?: string | null
    moderationReason?: string | null
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
const meta = reactive({
  avatarUrl: props.character.avatarUrl || '',
  description: props.character.description || ''
})
const saving = ref(false)
const publishing = ref(false)
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
const isRejected = computed(() => props.character.moderationStatus === 'REJECTED')

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
  if (!props.editable || isRejected.value) return
  saving.value = true
  try {
    const payload = { ...draft }
    await $fetch(`/api/characters/${props.character.id}`, {
      method: 'PUT',
      body: { dataJson: payload, avatarUrl: meta.avatarUrl, description: meta.description }
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

async function publishCharacter() {
  if (isRejected.value) return
  publishing.value = true
  try {
    await $fetch(`/api/characters/${props.character.id}/publish`, { method: 'POST' })
    push('Personagem enviado para analise da comunidade.', 'success')
  } catch (error) {
    apiError(error, 'Nao foi possivel publicar o personagem.')
  } finally {
    publishing.value = false
  }
}

watch(() => props.character.dataJson, (next) => {
  syncing.value = true
  for (const key of Object.keys(draft)) {
    if (!(key in next)) delete draft[key]
  }
  Object.assign(draft, next)
  meta.avatarUrl = props.character.avatarUrl || ''
  meta.description = props.character.description || ''
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
  <div class="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
    <CharacterSummaryCard
      :character="character"
      :avatar-url="meta.avatarUrl"
      :description="meta.description"
      :class-name="className"
      :editable="editable"
      :room-id="roomId"
      :is-rejected="isRejected"
      :moderation-reason="character.moderationReason"
      :saving="saving"
      :publishing="publishing"
      :saved-at="savedAt"
      @update-avatar="meta.avatarUrl = $event"
      @update-description="meta.description = $event"
      @save="save()"
      @publish="publishCharacter"
    />

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
