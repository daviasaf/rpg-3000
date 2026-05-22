<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  loading?: boolean
}>()

const emit = defineEmits<{ close: []; confirm: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div class="w-full max-w-md rounded-xl border border-white/10 bg-panel p-5 shadow-soft">
        <h2 class="text-xl font-black text-white">{{ title }}</h2>
        <p class="mt-2 text-sm leading-6 text-mist">{{ message }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <AppButton type="button" variant="ghost" @click="emit('close')">Cancelar</AppButton>
          <AppButton type="button" variant="danger" :loading="loading" @click="emit('confirm')">{{ confirmLabel || 'Confirmar' }}</AppButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

