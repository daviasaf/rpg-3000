<script setup lang="ts">
const props = withDefaults(defineProps<{
  name?: string | null
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: string | null
  rounded?: 'full' | 'lg'
}>(), {
  size: 'md',
  rounded: 'lg'
})

const failed = ref(false)

const initials = computed(() => {
  const parts = String(props.name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase()
})

const sizeClass = computed(() => ({
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl'
}[props.size]))

const radiusClass = computed(() => props.rounded === 'full' ? 'rounded-full' : 'rounded-lg')
const canShowImage = computed(() => Boolean(props.src && !failed.value))

watch(() => props.src, () => {
  failed.value = false
})
</script>

<template>
  <span
    class="grid shrink-0 place-items-center overflow-hidden border border-white/10 bg-white/[0.06] font-black text-white"
    :class="[sizeClass, radiusClass]"
    :style="{ backgroundColor: `${color || '#ff8a13'}2e`, borderColor: `${color || '#ff8a13'}66` }"
  >
    <img
      v-if="canShowImage"
      :src="src || ''"
      :alt="name || 'Avatar'"
      class="h-full w-full object-cover"
      @error="failed = true"
    >
    <span v-else>{{ initials }}</span>
  </span>
</template>
