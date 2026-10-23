import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Keep built asset paths relative so the dist folder can be hosted in a subfolder.
  base: './',
  plugins: [react()],
})
