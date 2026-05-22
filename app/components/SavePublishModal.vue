<script setup lang="ts">
defineProps<{
  open: boolean
  title?: string
  message?: string
  loading?: boolean
}>()

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
          <AppButton type="button" :loading="loading" @click="emit('publish')">Salvar e postar na comunidade</AppButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
