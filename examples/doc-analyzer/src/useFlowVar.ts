import { useState, useEffect } from 'react'
import { flow } from './flow.ts'

export function useFlowVar<T = any>(key: string): T | undefined {
  const [value, setValue] = useState<T | undefined>(() => flow.get(key))

  useEffect(() => {
    return flow.on((e) => {
      if (e.type === 'vars' && e.key === key) setValue(e.value)
    })
  }, [key])

  return value
}
