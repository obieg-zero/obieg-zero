const providers = new Map<string, unknown>()

export function registerProvider<T>(name: string, provider: T): void {
  providers.set(name, provider)
}

export function getProvider<T>(name: string): T | null {
  return (providers.get(name) ?? null) as T | null
}
