<script setup lang="ts">
import { MoreHorizontal } from 'lucide-vue-next'
import type { Component } from 'vue'

type ActionItem = {
  key: string
  label: string
  icon?: Component
  danger?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  items: ActionItem[]
  title?: string
  triggerClass?: string
}>(), {
  title: 'Acoes',
  triggerClass: ''
})

const emit = defineEmits<{ select: [key: string] }>()
const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

function updatePosition() {
  const trigger = triggerRef.value
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  const width = 184
  const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))
  const top = Math.min(rect.bottom + 8, window.innerHeight - 12)
  menuStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`
  }
}

async function toggle() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    updatePosition()
  }
}

function selectItem(item: ActionItem) {
  if (item.disabled) return
  emit('select', item.key)
  open.value = false
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Node | null
  if (!target) return
  if (triggerRef.value?.contains(target) || menuRef.value?.contains(target)) return
  open.value = false
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})
</script>

<template>
  <div :class="$slots.default ? 'min-w-0' : 'inline-flex'">
    <button
      ref="triggerRef"
      type="button"
      :class="$slots.default ? triggerClass : 'grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-mist transition hover:bg-white/10 hover:text-white'"
      :title="title"
      @click.stop="toggle"
    >
      <slot :open="open">
        <MoreHorizontal class="h-4 w-4" />
      </slot>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuRef"
        class="z-[80] rounded-lg border border-white/10 bg-panel p-1 shadow-soft"
        :style="menuStyle"
        @click.stop
      >
        <button
          v-for="item in props.items"
          :key="item.key"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45"
          :class="item.danger ? 'text-red-100 hover:bg-flare/15' : 'text-white hover:bg-white/10'"
          :disabled="item.disabled"
          @click="selectItem(item)"
        >
          <component :is="item.icon" v-if="item.icon" class="h-4 w-4" :class="item.danger ? 'text-red-200' : 'text-ember'" />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>
