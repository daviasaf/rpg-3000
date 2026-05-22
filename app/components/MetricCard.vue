<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  label: string
  value: string | number
  hint?: string
  icon?: Component
  tone?: 'ember' | 'arcane' | 'green' | 'blue'
}>()
</script>

<template>
  <section class="surface rounded-lg p-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.08em] text-mist">
          {{ label }}
        </p>
        <p class="mt-2 text-2xl font-black text-white">
          {{ value }}
        </p>
      </div>
      <div
        v-if="icon"
        class="grid h-10 w-10 place-items-center rounded-lg border"
        :class="{
          'border-ember/25 bg-ember/10 text-ember': !tone || tone === 'ember',
          'border-arcane/25 bg-arcane/10 text-violet-200': tone === 'arcane',
          'border-emerald-400/25 bg-emerald-400/10 text-emerald-200': tone === 'green',
          'border-sky-400/25 bg-sky-400/10 text-sky-200': tone === 'blue'
        }"
      >
        <component :is="icon" class="h-5 w-5" />
      </div>
    </div>
    <p v-if="hint" class="mt-3 text-sm text-mist">
      {{ hint }}
    </p>
  </section>
</template>

