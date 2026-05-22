<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean
  title?: string
  message?: string
  loading?: boolean
  canPublish?: boolean
  publishDisabledReason?: string
  publishLabel?: string
}>(), {
  canPublish: true,
  publishLabel: 'Salvar e postar na comunidade'
})

const emit = defineEmits<{ close: []; save: []; publish: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" @click.self="emit('close')">
      <div class="w-full max-w-lg rounded-xl border border-white/10 bg-panel p-5 shadow-soft">
        <h2 class="text-xl font-black text-white">{{ title || 'Como deseja salvar?' }}</h2>
        <p class="mt-2 text-sm leading-6 text-mist">
          {{ message || 'Salvar mantem a criacao pessoal. Salvar e postar cria um snapshot para analise da comunidade.' }}
        </p>
        <div class="mt-5 flex flex-wrap justify-end gap-2">
          <AppButton type="button" variant="ghost" :disabled="loading" @click="emit('close')">Cancelar</AppButton>
          <AppButton type="button" variant="ghost" :loading="loading" @click="emit('save')">Salvar</AppButton>
          <AppButton v-if="canPublish" type="button" :loading="loading" @click="emit('publish')">{{ publishLabel }}</AppButton>
          <p v-else class="max-w-xs rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">{{ publishDisabledReason || 'Este conteudo ja esta em analise. Voce pode salvar alteracoes privadas, mas nao pode postar novamente agora.' }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

