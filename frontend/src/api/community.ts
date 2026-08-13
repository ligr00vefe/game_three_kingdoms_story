import { api } from './client'

export interface DefenseRankingEntry {
  rank: number
  playerName: string
  characterName: string
  characterCode: string
  defenseStage: number
  level: number
}

export interface BugReport {
  id: number
  title: string
  content: string
  category: string
  status: string
  reporterName: string
  createdAt: string
}

export async function fetchDefenseRanking(): Promise<DefenseRankingEntry[]> {
  const { data } = await api.get<DefenseRankingEntry[]>('/community/defense-ranking')
  return data
}

export async function fetchBugReports(): Promise<BugReport[]> {
  const { data } = await api.get<BugReport[]>('/community/bug-reports')
  return data
}

export async function createBugReport(title: string, content: string, category: string): Promise<BugReport> {
  const { data } = await api.post<BugReport>('/community/bug-reports', { title, content, category })
  return data
}
