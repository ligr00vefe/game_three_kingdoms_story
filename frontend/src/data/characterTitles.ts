const TITLES_BY_CHARACTER: Readonly<Record<string, readonly string[]>> = {
  guanwu: ['별부사마', '편장군', '탕구장군', '전장군'],
  zhaoyun: ['아문장군', '익군장군', '정남장군', '진동장군'],
  lubu: ['기병도위', '중랑장', '분무장군', '좌장군'],
}

export function characterTitleForLevel(characterCode: string, level: number): string {
  const titles = TITLES_BY_CHARACTER[characterCode]
  if (!titles || level < 5) return '무명소졸'
  if (level >= 20) return titles[3]
  if (level >= 15) return titles[2]
  if (level >= 10) return titles[1]
  return titles[0]
}
