import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [
        react({
            jsxImportSource: '@emotion/react',
            babel: {
                plugins: ['@emotion/babel-plugin']
            }
        })
    ],
    resolve: {
        alias: {
            '@emotion/styled': '@emotion/styled/base'
        }
    },
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/api': {
                target: process.env.VITE_API_URL || "http://localhost:8000",
                changeOrigin: true,
                secure: false,
            }
        }
    },
    build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom'],
                    'mui-vendor': ['@mui/material', '@mui/icons-material'],
                    'pdf-vendor': ['pdfjs-dist']
                }
            }
        },
        outDir: 'dist',
        sourcemap: false
    }
})