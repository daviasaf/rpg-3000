<script setup lang="ts">
import { Pencil, Send, Trash2 } from 'lucide-vue-next'

type CommentAuthor = {
  id?: string | null
  name?: string | null
  username?: string | null
  avatarUrl?: string | null
  profileColor?: string | null
}

type CommentItem = {
  id: string
  content: string
  createdAt: string
  updatedAt?: string | null
  user?: CommentAuthor | null
}

const props = withDefaults(defineProps<{
  comments: CommentItem[]
  endpoint: string
  currentUserId?: string | null
  canDeleteAll?: boolean
  placeholder?: string
  emptyText?: string
  maxHeight?: boolean
  canCreate?: boolean
}>(), {
  placeholder: 'Comentar...',
  emptyText: 'Nenhum comentario ainda.',
  maxHeight: true,
  canCreate: true
})

const emit = defineEmits<{ refresh: [] }>()
const { push, apiError } = useToast()
const draft = ref('')
const sending = ref(false)
const editing = ref<{ id: string; content: string } | null>(null)
const pendingDeleteId = ref('')
const deleting = ref(false)

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function authorName(user?: CommentAuthor | null) {
  return user?.name?.trim() || 'Usuario removido'
}

function canEdit(item: CommentItem) {
  return Boolean(item.user?.id && item.user.id === props.currentUserId)
}

function canDelete(item: CommentItem) {
  return canEdit(item) || props.canDeleteAll
}

function commentUrl(id?: string) {
  return id ? `${props.endpoint}/${id}` : props.endpoint
}

async function submit() {
  const content = draft.value.trim()
  if (!content) return

  sending.value = true
  try {
    await $fetch(commentUrl(), { method: 'POST', body: { content } })
    draft.value = ''
    push('Comentario criado.', 'success')
    emit('refresh')
  } catch (error) {
    apiError(error, 'Nao foi possivel comentar.')
  } finally {
    sending.value = false
  }
}

async function save() {
  const content = editing.value?.content.trim()
  if (!editing.value || !content) return

  try {
    await $fetch(commentUrl(editing.value.id), { method: 'PUT', body: { content } })
    editing.value = null
    push('Comentario editado.', 'success')
    emit('refresh')
  } catch (error) {
    apiError(error, 'Nao foi possivel editar o comentario.')
  }
}

function actionItems(item: CommentItem) {
  return [
    ...(canEdit(item) ? [{ key: 'edit', label: 'Editar', icon: Pencil }] : []),
    { key: 'delete', label: 'Apagar', icon: Trash2, danger: true }
  ]
}

function handleAction(item: CommentItem, action: string) {
  if (action === 'edit') {
    editing.value = { id: item.id, content: item.content }
    return
  }

  if (action === 'delete') pendingDeleteId.value = item.id
}

async function remove() {
  if (!pendingDeleteId.value) return

  deleting.value = true
  try {
    await $fetch(commentUrl(pendingDeleteId.value), { method: 'DELETE' })
    pendingDeleteId.value = ''
    push('Comentario apagado.', 'success')
    emit('refresh')
  } catch (error) {
    apiError(error, 'Nao foi possivel apagar o comentario.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <form v-if="canCreate" class="flex flex-col gap-2 sm:flex-row" @submit.prevent="submit">
      <input v-model="draft" class="input" :placeholder="placeholder">
      <AppButton type="submit" :loading="sending"><Send class="h-4 w-4" />Enviar</AppButton>
    </form>

    <div class="space-y-2" :class="[canCreate ? 'mt-3' : '', maxHeight && comments.length > 5 ? 'max-h-80 overflow-y-auto pr-2' : '']">
      <div v-for="item in comments" :key="item.id" class="soft-row relative flex gap-3 p-3 pr-12">
        <AppAvatar :name="authorName(item.user)" :src="item.user?.avatarUrl" :color="item.user?.profileColor" rounded="full" size="sm" />
        <div class="min-w-0 flex-1 text-sm text-mist">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <b class="text-white">{{ authorName(item.user) }}</b>
            <span class="text-xs text-mist">{{ formatDate(item.createdAt) }}</span>
            <span v-if="item.updatedAt && item.updatedAt !== item.createdAt" class="text-xs text-mist">(editado)</span>
          </div>
          <textarea v-if="editing?.id === item.id" v-model="editing.content" class="input mt-2 min-h-20" />
          <p v-else class="mt-1 break-words leading-6">{{ item.content }}</p>
        </div>

        <div v-if="canDelete(item)" class="absolute right-3 top-3">
          <button v-if="editing?.id === item.id" type="button" class="text-xs font-bold text-ember" @click="save">Salvar</button>
          <AppActionMenu v-else title="Acoes do comentario" :items="actionItems(item)" @select="handleAction(item, $event)" />
        </div>
      </div>
      <p v-if="!comments.length" class="rounded-lg border border-dashed border-white/15 p-4 text-sm text-mist">{{ emptyText }}</p>
    </div>

    <ConfirmModal
      :open="!!pendingDeleteId"
      title="Apagar comentario"
      message="Tem certeza que deseja apagar este comentario? Esta acao nao pode ser desfeita."
      confirm-label="Apagar"
      :loading="deleting"
      @close="pendingDeleteId = ''"
      @confirm="remove"
    />
  </div>
</template>
