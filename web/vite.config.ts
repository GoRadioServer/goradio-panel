import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // bind 0.0.0.0, not just 127.0.0.1 -- needed for VS Code Remote-SSH port forwarding
    allowedHosts: true, // skip Vite's Host-header check, which forwarded/proxied requests can fail
    proxy: {
      '/api': 'http://localhost:8081',
    },
  },
})
