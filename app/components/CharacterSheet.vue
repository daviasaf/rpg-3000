<script setup lang="ts">
import { ChevronDown, Info } from 'lucide-vue-next'
import type { DynamicField, SystemSchema } from '../../shared/types/system'
import { classNotes, fieldSources } from '../utils/characterProgression'

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
const sourceField = ref<DynamicField | null>(null)
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
const sheetTexts = computed(() => props.character.system.schemaJson?.sheetTexts || [])
const visibleClassNotes = computed(() => classNotes(props.character.system.schemaJson, draft))
const selectedFieldSources = computed(() => sourceField.value ? fieldSources(sourceField.value, props.character.system.schemaJson, draft) : [])

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

function sourceItems() {
  return [{ key: 'source', label: 'Origem do valor', icon: Info }]
}

function handleFieldAction(field: DynamicField, action: string) {
  if (action === 'source') sourceField.value = field
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
      <AppCard v-if="sheetTexts.length">
        <h2 class="text-lg font-black text-white">Textos da ficha</h2>
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          <div v-for="item in sheetTexts" :key="item.id || item.name" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p class="text-xs font-black uppercase tracking-[0.12em] text-ember">{{ item.name }}</p>
            <p class="mt-2 text-sm leading-6 text-mist">{{ item.text }}</p>
          </div>
        </div>
      </AppCard>

      <AppCard v-if="visibleClassNotes.length" class="border-ember/25 bg-ember/5">
        <h2 class="text-lg font-black text-white">Textos da classe</h2>
        <div class="mt-3 space-y-2">
          <p v-for="item in visibleClassNotes" :key="`${item.level}-${item.note}`" class="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-mist">
            <b class="text-ember">{{ item.title }} nivel {{ item.level }}:</b> {{ item.note }}
          </p>
        </div>
      </AppCard>

      <AppCard v-for="group in groups" :key="group.category">
        <button type="button" class="flex w-full items-center justify-between gap-3 text-left" @click="toggleGroup(group.category)">
          <h2 class="text-lg font-black text-white">{{ categoryLabel(group.category) }}</h2>
          <ChevronDown class="h-5 w-5 text-ember transition" :class="isGroupOpen(group.category) ? 'rotate-180' : ''" />
        </button>
        <div v-if="isGroupOpen(group.category)" class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="field in group.fields" :key="field.key" class="relative" :class="field.type === 'TEXT' ? 'md:col-span-2 xl:col-span-3' : ''">
            <div class="absolute right-0 top-0 z-10">
              <AppActionMenu title="Detalhes do campo" :items="sourceItems()" @select="handleFieldAction(field, $event)" />
            </div>
            <DynamicFieldRenderer v-model="draft[field.key]" :field="field" :readonly="!editable" />
          </div>
        </div>
      </AppCard>
    </div>

    <Teleport to="body">
      <div v-if="sourceField" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" @click.self="sourceField = null">
        <div class="w-full max-w-md rounded-xl border border-white/10 bg-panel p-5 shadow-soft">
          <h2 class="text-xl font-black text-white">Origem de {{ sourceField.label }}</h2>
          <p class="mt-1 text-sm text-mist">Valor atual: {{ draft[sourceField.key] ?? '-' }}</p>
          <div class="mt-4 space-y-2">
            <div v-for="source in selectedFieldSources" :key="`${source.label}-${source.value}`" class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div class="flex items-center justify-between gap-3">
                <span class="font-black text-white">{{ source.label }}</span>
                <span class="text-sm font-black text-ember">{{ source.value }}</span>
              </div>
              <p v-if="source.note" class="mt-1 text-xs leading-5 text-mist">{{ source.note }}</p>
            </div>
          </div>
          <div class="mt-5 flex justify-end">
            <AppButton type="button" variant="ghost" @click="sourceField = null">Fechar</AppButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
