import { api } from './client'

export interface HealthResponse {
  status: string
  game: string
  serverTime: string
}

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health')
  return data
}
