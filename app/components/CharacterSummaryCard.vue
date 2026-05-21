<script setup lang="ts">
import { Send, Save, X } from 'lucide-vue-next'

const props = defineProps<{
  character: {
    name: string
    dataJson: Record<string, unknown>
    system: { name: string }
  }
  avatarUrl: string
  description: string
  className?: string
  editable?: boolean
  roomId?: string
  isRejected?: boolean
  moderationReason?: string | null
  saving?: boolean
  publishing?: boolean
  savedAt?: Date | null
}>()

const emit = defineEmits<{
  updateAvatar: [value: string]
  updateDescription: [value: string]
  save: []
  publish: []
}>()
</script>

<template>
  <AppCard class="flex min-h-0 flex-col overflow-hidden lg:max-h-[540px]">
    <div class="h-36 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-ember/20 to-arcane/20 sm:h-40 lg:h-32">
      <img v-if="avatarUrl" :src="avatarUrl" :alt="character.name" class="h-full w-full object-cover">
      <div v-else class="grid h-full place-items-center">
        <AppAvatar :name="character.name" size="xl" />
      </div>
    </div>

    <div class="min-w-0 shrink-0">
      <span class="mt-4 inline-flex max-w-full truncate rounded-md border border-ember/25 bg-ember/10 px-2 py-0.5 text-[11px] font-bold text-ember">
        {{ character.system.name }}
      </span>
      <h1 class="mt-2 truncate text-2xl font-black text-white" :title="character.name">{{ character.name }}</h1>
      <p v-if="className" class="mt-1 truncate text-sm font-bold text-ember">{{ className }} nivel {{ character.dataJson.nivel || 1 }}</p>
      <p class="mt-2 line-clamp-3 text-sm leading-6 text-mist">{{ description || 'Sem descricao.' }}</p>
    </div>

    <p v-if="isRejected" class="mt-4 shrink-0 rounded-lg border border-flare/35 bg-flare/10 p-3 text-sm font-bold text-red-100">
      {{ moderationReason || 'Ficha rejeitada e bloqueada para edicao.' }}
    </p>

    <div v-if="editable && !isRejected && !roomId" class="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      <label>
        <span class="label">Foto do personagem</span>
        <input :value="avatarUrl" class="input" type="url" placeholder="https://..." @input="emit('updateAvatar', ($event.target as HTMLInputElement).value)">
      </label>
      <label>
        <span class="label">Descricao curta</span>
        <textarea :value="description" class="input min-h-20" @input="emit('updateDescription', ($event.target as HTMLTextAreaElement).value)" />
      </label>
    </div>

    <div v-if="editable && !isRejected" class="mt-5 shrink-0 grid gap-2">
      <AppButton class="w-full" :loading="saving" @click="emit('save')"><Save class="h-4 w-4" />Salvar ficha</AppButton>
      <AppButton v-if="!roomId" variant="ghost" class="w-full" :loading="publishing" @click="emit('publish')"><Send class="h-4 w-4" />Publicar personagem</AppButton>
    </div>

    <p v-if="editable && savedAt" class="mt-3 shrink-0 text-xs font-bold text-mist">
      Salva as {{ savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}
    </p>
  </AppCard>
</template>
