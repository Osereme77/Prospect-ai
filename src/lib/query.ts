const normalizeToken = (value: string) => value.trim().replace(/\s+/g, ' ')

export function buildSuggestedQuery(skills: string[], services: string[], markets: string[]): string {
  const unique = new Map<string, string>()
  const add = (values: string[], limit: number) => {
    let count = 0
    for (const candidate of values) {
      const token = normalizeToken(candidate)
      const key = token.toLocaleLowerCase()
      if (!token || unique.has(key)) continue
      unique.set(key, token)
      if (++count === limit) break
    }
  }
  add(skills, 4)
  add(services, 2)
  add(markets, 1)
  return [...unique.values()].join(' ').slice(0, 520)
}
