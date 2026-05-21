<script setup lang="ts">
import { ChevronDown, Info, Plus, Trash2 } from 'lucide-vue-next'
import type { DynamicField, SystemSchema } from '../../shared/types/system'
import { classNotes, fieldSources } from '../utils/characterProgression'

type ExtraField = { id: string; name: string; value: string }
type SheetListItem = { id: string; name: string; description: string; damage?: string; skill?: string; extras?: ExtraField[] }
type SheetTextBlock = { name: string; description: string }

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
const sheetLists = computed(() => (props.character.system.schemaJson?.sheetLists || []).filter((list) => list.enabled !== false))
const visibleClassNotes = computed(() => classNotes(props.character.system.schemaJson, draft))
const selectedFieldSources = computed(() => sourceField.value ? fieldSources(sourceField.value, props.character.system.schemaJson, draft) : [])
const defaultBuiltInSections = [
  { key: 'items', title: 'Itens', multiple: true, damage: false, skill: false, extras: false },
  { key: 'weapons', title: 'Armas', multiple: true, damage: true, skill: true, extras: false },
  { key: 'traits', title: 'Tracos / Talentos', multiple: true, damage: false, skill: false, extras: false },
  { key: 'powers', title: 'Poderes', multiple: true, damage: true, skill: false, extras: false },
  { key: 'biography', title: 'Biografia', multiple: false, damage: false, skill: false, extras: false },
  { key: 'appearance', title: 'Aparencia', multiple: false, damage: false, skill: false, extras: false },
  { key: 'personality', title: 'Alinhamento / Personalidade', multiple: false, damage: false, skill: false, extras: false },
  { key: 'conditions', title: 'Condicoes', multiple: true, damage: false, skill: false, extras: false }
]
const builtInSections = computed(() => {
  const configured = props.character.system.schemaJson?.sheetSections
  if (!configured?.length) return defaultBuiltInSections

  return configured
    .filter((section) => section.enabled !== false)
    .map((section) => ({
      key: section.key,
      title: section.title,
      multiple: Boolean(section.multiple),
      damage: Boolean(section.allowDamage),
      skill: Boolean(section.allowSkill),
      extras: Boolean(section.allowExtras)
    }))
})
const rulesMarkdown = computed(() => props.character.system.schemaJson?.rulesMarkdown || '')

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

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function listItems(key: string): SheetListItem[] {
  if (!Array.isArray(draft[key])) draft[key] = []
  return draft[key] as SheetListItem[]
}

function singleBlock(key: string): SheetTextBlock {
  if (!draft[key] || typeof draft[key] !== 'object' || Array.isArray(draft[key])) {
    draft[key] = { name: '', description: '' }
  }
  return draft[key] as SheetTextBlock
}

function addListItem(key: string) {
  listItems(key).push({ id: uid(key), name: '', description: '', damage: '', skill: '', extras: [] })
}

function removeListItem(key: string, index: number) {
  listItems(key).splice(index, 1)
}

function addExtra(item: SheetListItem) {
  item.extras ||= []
  item.extras.push({ id: uid('extra'), name: '', value: '' })
}

function removeExtra(item: SheetListItem, index: number) {
  item.extras?.splice(index, 1)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderMarkdown(value: unknown) {
  const escaped = escapeHtml(String(value || ''))
  return escaped
    .replace(/^### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^## (.*)$/gm, '<h3>$1</h3>')
    .replace(/^# (.*)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
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
          <div v-for="field in group.fields" :key="field.key" class="space-y-2" :class="field.type === 'TEXT' ? 'md:col-span-2 xl:col-span-3' : ''">
            <div class="flex justify-end">
              <AppActionMenu title="Detalhes do campo" :items="sourceItems()" trigger-class="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-mist hover:text-white" @select="handleFieldAction(field, $event)" />
            </div>
            <DynamicFieldRenderer v-model="draft[field.key]" :field="field" :readonly="!editable" />
          </div>
        </div>
      </AppCard>

      <AppCard v-for="section in builtInSections" :key="section.key">
        <button type="button" class="flex w-full items-center justify-between gap-3 text-left" @click="toggleGroup(`builtin:${section.key}`)">
          <h2 class="text-lg font-black text-white">{{ section.title }}</h2>
          <ChevronDown class="h-5 w-5 text-ember transition" :class="isGroupOpen(`builtin:${section.key}`) ? 'rotate-180' : ''" />
        </button>
        <div v-if="isGroupOpen(`builtin:${section.key}`)" class="mt-4">
          <div v-if="section.multiple" class="space-y-3">
            <div
              v-for="(item, index) in listItems(section.key)"
              :key="item.id || index"
              class="rounded-lg border border-white/10 bg-white/[0.04] p-3"
            >
              <div class="grid gap-3 md:grid-cols-[1fr_160px_160px_auto]">
                <label>
                  <span class="label">Nome</span>
                  <input v-model="item.name" class="input" :readonly="!editable" placeholder="Nome">
                </label>
                <label v-if="section.damage">
                  <span class="label">Dano</span>
                  <input v-model="item.damage" class="input" :readonly="!editable" placeholder="1d8">
                </label>
                <label v-if="section.skill">
                  <span class="label">Habilidade</span>
                  <input v-model="item.skill" class="input" :readonly="!editable" placeholder="Opcional">
                </label>
                <button v-if="editable" type="button" class="self-end rounded-lg border border-flare/30 p-3 text-flare hover:bg-flare/10" title="Remover" @click="removeListItem(section.key, index)">
                  <Trash2 class="h-4 w-4" />
                </button>
                <label class="md:col-span-4">
                  <span class="label">Texto / descricao</span>
                  <textarea v-model="item.description" rows="3" class="input" :readonly="!editable" />
                </label>
              </div>
            </div>
            <button v-if="editable" type="button" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-bold text-white hover:border-ember/40" @click="addListItem(section.key)">
              <Plus class="h-4 w-4" />Adicionar
            </button>
            <p v-if="!listItems(section.key).length" class="rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">Nada cadastrado nesta secao.</p>
          </div>

          <div v-else class="grid gap-3">
            <label>
              <span class="label">Nome</span>
              <input v-model="singleBlock(section.key).name" class="input" :readonly="!editable" placeholder="Titulo opcional">
            </label>
            <label>
              <span class="label">Texto / descricao</span>
              <textarea v-model="singleBlock(section.key).description" rows="5" class="input" :readonly="!editable" />
            </label>
          </div>
        </div>
      </AppCard>

      <AppCard v-for="list in sheetLists" :key="list.id || list.key">
        <button type="button" class="flex w-full items-center justify-between gap-3 text-left" @click="toggleGroup(`custom:${list.key}`)">
          <span>
            <h2 class="text-lg font-black text-white">{{ list.name }}</h2>
            <p v-if="list.description" class="mt-1 text-sm text-mist">{{ list.description }}</p>
          </span>
          <ChevronDown class="h-5 w-5 text-ember transition" :class="isGroupOpen(`custom:${list.key}`) ? 'rotate-180' : ''" />
        </button>
        <div v-if="isGroupOpen(`custom:${list.key}`)" class="mt-4 space-y-3">
          <div
            v-for="(item, index) in listItems(list.key)"
            :key="item.id || index"
            class="rounded-lg border border-white/10 bg-white/[0.04] p-3"
          >
            <div class="grid gap-3 md:grid-cols-[1fr_150px_150px_auto]">
              <label>
                <span class="label">Nome</span>
                <input v-model="item.name" class="input" :readonly="!editable" placeholder="Katana, bola de fogo...">
              </label>
              <label v-if="list.allowDamage">
                <span class="label">Dano fixo</span>
                <input v-model="item.damage" class="input" :readonly="!editable" placeholder="1d8">
              </label>
              <label v-if="list.allowSkill">
                <span class="label">Habilidade</span>
                <input v-model="item.skill" class="input" :readonly="!editable" placeholder="Opcional">
              </label>
              <button v-if="editable" type="button" class="self-end rounded-lg border border-flare/30 p-3 text-flare hover:bg-flare/10" title="Remover item" @click="removeListItem(list.key, index)">
                <Trash2 class="h-4 w-4" />
              </button>
              <label class="md:col-span-4">
                <span class="label">Descricao longa</span>
                <textarea v-model="item.description" rows="4" class="input" :readonly="!editable" />
              </label>
            </div>
            <div v-if="list.allowExtras" class="mt-3 space-y-2">
              <div v-for="(extra, extraIndex) in item.extras || []" :key="extra.id || extraIndex" class="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                <input v-model="extra.name" class="input" :readonly="!editable" placeholder="Campo extra">
                <input v-model="extra.value" class="input" :readonly="!editable" placeholder="Valor ou texto">
                <button v-if="editable" type="button" class="rounded-lg border border-flare/30 p-3 text-flare hover:bg-flare/10" title="Remover campo extra" @click="removeExtra(item, extraIndex)">
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <button v-if="editable" type="button" class="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-bold text-white hover:border-ember/40" @click="addExtra(item)">
                <Plus class="h-4 w-4" />Campo extra
              </button>
            </div>
          </div>
          <button v-if="editable" type="button" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-bold text-white hover:border-ember/40" @click="addListItem(list.key)">
            <Plus class="h-4 w-4" />Adicionar {{ list.name }}
          </button>
          <p v-if="!listItems(list.key).length" class="rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">Nenhum item nesta lista.</p>
        </div>
      </AppCard>

      <AppCard v-if="rulesMarkdown">
        <button type="button" class="flex w-full items-center justify-between gap-3 text-left" @click="toggleGroup('rulesMarkdown')">
          <h2 class="text-lg font-black text-white">Regras gerais</h2>
          <ChevronDown class="h-5 w-5 text-ember transition" :class="isGroupOpen('rulesMarkdown') ? 'rotate-180' : ''" />
        </button>
        <div v-if="isGroupOpen('rulesMarkdown')" class="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-mist">
          <div class="markdown-preview" v-html="renderMarkdown(rulesMarkdown)" />
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

<style scoped>
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4) {
  margin: 0.75rem 0 0.35rem;
  color: white;
  font-weight: 900;
}

.markdown-preview :deep(code) {
  border: 1px solid rgb(255 255 255 / 0.1);
  border-radius: 0.35rem;
  background: rgb(255 255 255 / 0.06);
  padding: 0.05rem 0.3rem;
  color: var(--color-ember, #ff8a13);
}
</style>
