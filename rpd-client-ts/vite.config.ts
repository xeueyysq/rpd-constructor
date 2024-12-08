import react from '@vitejs/plugin-react-swc'
import {defineConfig} from 'vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 3000,
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
    },
    resolve: {
        alias: {
            '@app': path.resolve(__dirname, 'src/app'),
            '@pages': path.resolve(__dirname, 'src/pages'),
            '@widgets': path.resolve(__dirname, 'src/widgets'),
            '@features': path.resolve(__dirname, 'src/features'),
            '@entities': path.resolve(__dirname, 'src/entities'),
            '@shared': path.resolve(__dirname, 'src/shared'),
        },
    },
})