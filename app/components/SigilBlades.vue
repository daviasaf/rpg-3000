<script setup lang="ts">
import { Swords } from 'lucide-vue-next'
</script>

<template>
  <div class="relative grid place-items-center">
    <div class="absolute h-56 w-56 rounded-full bg-ember/10 blur-3xl" />
    <div class="relative flex items-center gap-8 text-ember">
      <Swords v-for="item in 3" :key="item" class="h-24 w-24 drop-shadow-[0_0_18px_rgba(255,90,40,.45)]" :stroke-width="1.4" />
    </div>
  </div>
</template>
