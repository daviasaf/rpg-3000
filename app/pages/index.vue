<script setup lang="ts">
import { Swords } from 'lucide-vue-next'
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-void text-white">
    <div class="absolute inset-0 opacity-70">
      <div class="landing-grid h-full w-full" />
    </div>
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,138,19,.13),transparent_32%),linear-gradient(180deg,rgba(3,2,10,.2),#05030b_86%)]" />

    <header class="relative z-20 border-b border-white/10 bg-black/35">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <NuxtLink to="/" class="flex items-center gap-3 font-black">
          <span class="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-ember to-flare text-black shadow-[0_4px_12px_rgba(255,138,19,0.16)]">
            <Swords class="h-5 w-5" />
          </span>
          <span>Central RPG 3000</span>
        </NuxtLink>
      </div>
    </header>

    <main class="relative z-10 mx-auto flex min-h-[calc(100vh-73px)] max-w-5xl items-center px-5 py-16">
      <section class="grid w-full items-center gap-12 md:grid-cols-[1fr_220px]">
        <div>
          <p class="mb-4 text-sm font-black uppercase tracking-[0.16em] text-ember">Mesa online de RPG</p>
          <h1 class="max-w-3xl text-5xl font-black tracking-tight text-white sm:text-6xl">
            Central RPG 3000
          </h1>
          <p class="mt-6 max-w-2xl text-lg leading-8 text-mist">
            Crie sua mesa, chame os jogadores e jogue com chat, dados, iniciativa, fichas e sistemas personalizados.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink to="/register"><AppButton>Jogar RPG</AppButton></NuxtLink>
          </div>
        </div>

        <div class="hidden justify-center md:flex">
          <div class="grid h-44 w-44 place-items-center rounded-2xl border border-ember/30 bg-black/35 shadow-[0_6px_18px_rgba(255,138,19,0.14)]">
            <Swords class="h-20 w-20 text-ember" :stroke-width="1.4" />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.landing-grid {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 36px 36px;
}
</style>
