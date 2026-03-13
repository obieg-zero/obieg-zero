type ActionFn = (...args: any[]) => void | Promise<void>
type Entry = { fn: ActionFn; priority: number }

const actions = new Map<string, Entry[]>()

export function addAction(hook: string, fn: ActionFn, priority = 10): () => void {
  if (!actions.has(hook)) actions.set(hook, [])
  const entry: Entry = { fn, priority }
  const list = actions.get(hook)!
  list.push(entry)
  list.sort((a, b) => a.priority - b.priority)
  return () => { const i = list.indexOf(entry); if (i >= 0) list.splice(i, 1) }
}

export function doAction(hook: string, ...args: unknown[]): void {
  const list = actions.get(hook)
  if (!list) return
  for (const { fn } of list) fn(...args)
}

export function resetHooks(): void {
  actions.clear()
}
