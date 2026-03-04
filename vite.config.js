import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    createSvgIconsPlugin({
      iconDirs: [path.resolve(__dirname, 'src/assets/svg')],
      symbolId: 'icon-[name]',
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
