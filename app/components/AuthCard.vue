<script setup lang="ts">
defineProps<{ title: string; subtitle: string }>()
</script>

<template>
  <section class="surface w-full max-w-md rounded-xl p-6">
    <h1 class="text-2xl font-black tracking-tight text-white">{{ title }}</h1>
    <p class="mt-1 text-sm text-mist">{{ subtitle }}</p>
    <div class="mt-6">
      <slot />
    </div>
  </section>
</template>

