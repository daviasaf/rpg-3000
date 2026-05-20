<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
  type?: 'button' | 'submit'
  loading?: boolean
  disabled?: boolean
}>(), {
  variant: 'primary',
  type: 'button',
  loading: false,
  disabled: false
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-ember/40 disabled:cursor-not-allowed disabled:opacity-60"
    :class="{
      'bg-ember text-black shadow-[0_1px_0_rgba(255,255,255,0.20)_inset] hover:bg-amber-400': variant === 'primary',
      'border border-white/10 bg-white/[0.06] text-white hover:border-ember/45 hover:bg-white/[0.09]': variant === 'ghost',
      'border border-flare/35 bg-flare/15 text-red-100 hover:bg-flare/25': variant === 'danger',
      'bg-white/[0.05] text-mist hover:bg-white/[0.08] hover:text-white': variant === 'subtle'
    }"
  >
    <span v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
    <slot />
  </button>
</template>
