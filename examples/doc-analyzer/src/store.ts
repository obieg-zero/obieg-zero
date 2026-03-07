import { create } from 'zustand'
import { modules } from './modules.ts'
import { flow } from './flow.ts'

interface AppState {
  activePageId: string
  openSheetId: string | null
  enabledModules: string[]
  setPage: (id: string) => void
  toggleSheet: (id: string) => void
  closeSheet: () => void
  toggleModule: (id: string) => void
  setFlowSetting: (moduleId: string, key: string, value: any) => void
  getFlowSetting: (moduleId: string, key: string) => any
  toggleFlowModule: (moduleId: string) => void
  init: () => void
}

function loadSettings(): Record<string, Record<string, any>> {
  try {
    const raw = localStorage.getItem('flowSettings')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveSettings(settings: Record<string, Record<string, any>>) {
  localStorage.setItem('flowSettings', JSON.stringify(settings))
}

export const useApp = create<AppState>((set, get) => ({
  activePageId: '',
  openSheetId: null,
  enabledModules: [],

  init: () => {
    // restore flow module settings from localStorage
    const saved = loadSettings()
    for (const mod of flow.modules()) {
      if (saved[mod.def.id]) {
        flow.configure(mod.def.id, saved[mod.def.id])
      }
    }

    // restore disabled modules
    const disabledRaw = localStorage.getItem('disabledFlowModules')
    let disabled: string[] = []
    try { disabled = disabledRaw ? JSON.parse(disabledRaw) : [] } catch {}
    for (const id of disabled) {
      try { flow.disable(id) } catch {}
    }

    // UI modules
    const savedUi = localStorage.getItem('enabledModules')
    let enabled: string[]
    try { enabled = savedUi ? JSON.parse(savedUi) : modules.map(m => m.id) }
    catch { enabled = modules.map(m => m.id) }
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

  setFlowSetting: (moduleId, key, value) => {
    flow.configure(moduleId, { [key]: value })
    const all = loadSettings()
    if (!all[moduleId]) all[moduleId] = {}
    all[moduleId][key] = value
    saveSettings(all)
  },

  getFlowSetting: (moduleId, key) => {
    const mod = flow.module(moduleId)
    return mod?.config[key]
  },

  toggleFlowModule: (moduleId) => {
    const mod = flow.module(moduleId)
    if (!mod) return
    if (mod.enabled) flow.disable(moduleId)
    else flow.enable(moduleId)

    // persist
    const disabled = flow.modules().filter(m => !m.enabled).map(m => m.def.id)
    localStorage.setItem('disabledFlowModules', JSON.stringify(disabled))
  },

  toggleModule: (id) => set(s => {
    const has = s.enabledModules.includes(id)
    const next = has ? s.enabledModules.filter(m => m !== id) : [...s.enabledModules, id]
    localStorage.setItem('enabledModules', JSON.stringify(next))
    return { enabledModules: next, openSheetId: s.openSheetId === id ? null : s.openSheetId }
  }),
}))
