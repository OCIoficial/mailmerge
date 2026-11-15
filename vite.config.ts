import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // En GitHub Pages la app se sirve bajo /<repo>/; el workflow define BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
