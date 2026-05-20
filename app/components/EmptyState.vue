<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon?: Component
  title: string
  description?: string
}>()
</script>

<template>
  <div class="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
    <div v-if="icon" class="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-ember">
      <component :is="icon" class="h-5 w-5" />
    </div>
    <h3 class="mt-4 text-base font-black text-white">
      {{ title }}
    </h3>
    <p v-if="description" class="mx-auto mt-2 max-w-md text-sm leading-6 text-mist">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-5 flex justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
