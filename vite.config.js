import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Electron 中使用 file:// 加载 dist/index.html，需要相对路径
  base: './',
})
