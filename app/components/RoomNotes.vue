<script setup lang="ts">
const props = defineProps<{
  roomId: string
  userId?: string | null
  isMaster?: boolean
}>()

const content = ref('')
const title = computed(() => props.isMaster ? 'Notas do mestre' : 'Notas do jogador')
const placeholder = computed(() => props.isMaster ? 'Planos, pistas, recompensas e bastidores...' : 'Objetivos, pistas, inventario e lembretes...')
const storageKey = computed(() => {
  const owner = props.isMaster ? 'master' : `player:${props.userId || 'anon'}`
  return `central-rpg:room:${props.roomId}:notes:${owner}`
})

function load() {
  if (!import.meta.client) return
  content.value = localStorage.getItem(storageKey.value) || ''
}

watch(storageKey, load)
watch(content, (next) => {
  if (!import.meta.client) return
  localStorage.setItem(storageKey.value, next)
})

onMounted(load)
</script>

<template>
  <AppCard>
    <h3 class="text-lg font-black text-white">{{ title }}</h3>
    <textarea v-model="content" class="input mt-4 min-h-32" :placeholder="placeholder" />
  </AppCard>
</template>
