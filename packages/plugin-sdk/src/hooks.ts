type ActionFn = (...args: any[]) => void | Promise<void>

const actions = new Map<string, ActionFn[]>()

export function addAction(hook: string, fn: ActionFn): () => void {
  if (!actions.has(hook)) actions.set(hook, [])
  const list = actions.get(hook)!
  list.push(fn)
  return () => { const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1) }
}

export function doAction(hook: string, ...args: unknown[]): void {
  const list = actions.get(hook)
  if (!list) return
  for (const fn of list) fn(...args)
}
