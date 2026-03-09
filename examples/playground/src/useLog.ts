import { useState, useCallback } from 'react'

export function useLog() {
  const [entries, setEntries] = useState<string[]>([])

  const log = useCallback((msg: string) => {
    setEntries(prev => [...prev, `${new Date().toLocaleTimeString()} ${msg}`])
  }, [])

  const clear = useCallback(() => setEntries([]), [])

  return { entries, log, clear }
}
