<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <p v-if="eyebrow" class="text-xs font-black uppercase tracking-[0.12em] text-ember">
        {{ eyebrow }}
      </p>
      <h1 class="mt-1 page-title">
        {{ title }}
      </h1>
      <p v-if="description" class="muted mt-2 max-w-2xl">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
