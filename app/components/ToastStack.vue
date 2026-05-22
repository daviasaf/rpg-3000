<script setup lang="ts">
import { X } from 'lucide-vue-next'

const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="fixed right-4 top-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-glow"
      :class="{
        'border-emerald-400/30 bg-emerald-950/80 text-emerald-50': toast.type === 'success',
        'border-flare/35 bg-red-950/80 text-red-50': toast.type === 'error',
        'border-arcane/35 bg-panel/90 text-white': toast.type === 'info'
      }"
    >
      <div class="min-w-0 flex-1">
        <span>{{ toast.message }}</span>
        <div v-if="toast.actions?.length" class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="action in toast.actions"
            :key="action.label"
            type="button"
            class="rounded-md border border-white/10 px-2 py-1 text-xs font-black hover:bg-white/10"
            @click="action.run(); dismiss(toast.id)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
      <button type="button" class="rounded p-0.5 opacity-75 hover:bg-white/10 hover:opacity-100" @click="dismiss(toast.id)">
        <X class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

