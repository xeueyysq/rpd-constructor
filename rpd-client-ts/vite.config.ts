// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react-swc'

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   server: {
//     proxy: {
//       '/api': {
//         target: "http://localhost:8000"
//       }
//     }
//   }
// })

import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    open: true,
    port: 5173,
    proxy: {
      '/api': {
        target: "http://rpd-server:8000",
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