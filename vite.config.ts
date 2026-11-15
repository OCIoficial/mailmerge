import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: la app funciona en cualquier dominio o ruta (github.io/<repo>/, un dominio
  // propio, o el repo renombrado). No hay rutas propias, solo #review, así que no hace falta una base fija.
  base: './',
  plugins: [react()],
})
