import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/mobile-debug/',
  ...process.env.RABBY_GO_ENV === 'mobile-production' && {
    base: '/mobile/',
  },
  ...process.env.RABBY_GO_ENV === 'mobile-regression' && {
    base: '/mobile-regression/',
  },
  mode: process.env.RABBY_GO_ENV || 'mobile-debug',
})
