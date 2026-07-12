import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 개발 중 프론트(5173) → 백엔드(8080) 프록시. CORS 회피의 기본 경로
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Phaser(~1MB)를 별도 청크로 분리 → 초기 로드 경량화 (DEVELOPMENT_PLAN 문제 4)
        manualChunks(id: string) {
          if (id.includes('node_modules/phaser')) return 'phaser'
        },
      },
    },
  },
})
