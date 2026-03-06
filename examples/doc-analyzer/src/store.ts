import { create } from 'zustand'
import { modules } from './modules.ts'

interface AppState {
  activePageId: string
  openSheetId: string | null
  enabledModules: string[]
  setPage: (id: string) => void
  toggleSheet: (id: string) => void
  closeSheet: () => void
  toggleModule: (id: string) => void
  init: () => void
}

export const useApp = create<AppState>((set) => ({
  activePageId: '',
  openSheetId: null,
  enabledModules: [],

  init: () => {
    const saved = localStorage.getItem('enabledModules')
    const enabled = saved ? JSON.parse(saved) : modules.map(m => m.id)
    const hash = location.hash.slice(1)
    const firstPage = modules.find(m => m.type === 'page' && enabled.includes(m.id))
    set({
      enabledModules: enabled,
      activePageId: enabled.includes(hash) ? hash : firstPage?.id ?? '',
    })
  },

  setPage: (id) => {
    location.hash = id
    set({ activePageId: id })
  },

  toggleSheet: (id) => set(s => ({ openSheetId: s.openSheetId === id ? null : id })),
  closeSheet: () => set({ openSheetId: null }),

  toggleModule: (id) => set(s => {
    const has = s.enabledModules.includes(id)
    const next = has ? s.enabledModules.filter(m => m !== id) : [...s.enabledModules, id]
    localStorage.setItem('enabledModules', JSON.stringify(next))
    return { enabledModules: next, openSheetId: s.openSheetId === id ? null : s.openSheetId }
  }),
}))
