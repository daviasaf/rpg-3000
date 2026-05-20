import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/app.vue'
  ],
  theme: {
    extend: {
      colors: {
        void: '#05050d',
        night: '#0b0915',
        panel: '#121020',
        panel2: '#19162a',
        ember: '#ff8a13',
        flare: '#ff453d',
        arcane: '#8b5cf6',
        mist: '#a6a2bd'
      },
      boxShadow: {
        glow: '0 10px 24px rgba(0, 0, 0, 0.18)',
        ember: '0 10px 24px rgba(0, 0, 0, 0.20)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
