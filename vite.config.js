import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [tailwindcss(), vue()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        proxy: {
            '/api': {
                target: 'https://rotamax-api.duckdns.org',
                changeOrigin: true,
                secure: true,
            },
            '/broadcasting/auth': {
                target: 'https://rotamax-api.duckdns.org',
                changeOrigin: true,
                secure: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
});
