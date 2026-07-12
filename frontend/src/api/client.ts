import axios from 'axios'

/** 공용 API 클라이언트. 개발 중엔 Vite 프록시(/api → :8080)를 탄다. */
export const api = axios.create({
  baseURL: '/api',
  timeout: 5000,
})
