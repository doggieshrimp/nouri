import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths so the same build works in the Android app and on GitHub Pages
  // (which serves from /<repo-name>/).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
})
