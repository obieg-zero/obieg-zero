import { create } from 'zustand'
import { modules } from './modules.ts'
import { flow } from './flow.ts'
import { loadSettings, saveSettings } from '@obieg-zero/storage'

interface AppState {
  activePageId: string
  openSheetId: string | null
  enabledModules: string[]
  ready: boolean
  setPage: (id: string) => void
  toggleSheet: (id: string) => void
  closeSheet: () => void
  toggleModule: (id: string) => void
  setFlowSetting: (moduleId: string, key: string, value: any) => void
  toggleFlowModule: (moduleId: string) => void
  init: () => Promise<void>
}

export const useApp = create<AppState>((set) => ({
  activePageId: '',
  openSheetId: null,
  enabledModules: [],
  ready: false,

  init: async () => {
    // restore flow module settings from IndexedDB
    const flowSettings = await loadSettings('flowSettings') ?? {}
    for (const mod of flow.modules()) {
      if (flowSettings[mod.def.id]) {
        flow.configure(mod.def.id, flowSettings[mod.def.id])
      }
    }

    // restore disabled modules
    const disabled: string[] = await loadSettings('disabledFlowModules') ?? []
    for (const id of disabled) {
      try { flow.disable(id) } catch {}
    }

    // UI modules
    const savedUi: string[] | undefined = await loadSettings('enabledUiModules')
    const all = modules()
    const enabled = savedUi ?? all.map(m => m.id)
    const hash = location.hash.slice(1)
    const firstPage = all.find(m => m.type === 'page' && enabled.includes(m.id))
    set({
      ready: true,
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
    // persist full config snapshot — no read-modify-write race
    const snapshot: Record<string, any> = {}
    for (const mod of flow.modules()) {
      snapshot[mod.def.id] = { ...mod.config }
    }
    saveSettings('flowSettings', snapshot)
  },

  toggleFlowModule: (moduleId) => {
    const mod = flow.module(moduleId)
    if (!mod) return
    if (mod.enabled) flow.disable(moduleId)
    else flow.enable(moduleId)
    const disabled = flow.modules().filter(m => !m.enabled).map(m => m.def.id)
    saveSettings('disabledFlowModules', disabled)
  },

  toggleModule: (id) => set(s => {
    const has = s.enabledModules.includes(id)
    const next = has ? s.enabledModules.filter(m => m !== id) : [...s.enabledModules, id]
    saveSettings('enabledUiModules', next)
    return { enabledModules: next, openSheetId: s.openSheetId === id ? null : s.openSheetId }
  }),
}))
