export default defineNuxtConfig({
  compatibilityDate: '2026-05-19',
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
    gmailUser: process.env.GMAIL_USER,
    gmailPass: process.env.GMAIL_PASS,
    public: {
      appUrl: process.env.APP_URL || 'http://localhost:3000'
    }
  },
  app: {
    head: {
      title: 'Central RPG 3000',
      htmlAttrs: { lang: 'pt-BR' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Plataforma online para mesas, fichas e sistemas genéricos de RPG.' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  }
})

