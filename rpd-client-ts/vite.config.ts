import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || "http://server:8000",
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: "build",
    sourcemap: true,
  }
})