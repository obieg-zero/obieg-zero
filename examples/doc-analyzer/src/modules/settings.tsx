import { useState } from 'react'
import { registerModule } from '../modules.ts'
import { useApp } from '../store.ts'
import { flow } from '../flow.ts'
import type { SettingDef } from '@obieg-zero/core'

function SettingField({ moduleId, settingKey, def }: { moduleId: string; settingKey: string; def: SettingDef }) {
  const setFlowSetting = useApp(s => s.setFlowSetting)
  const mod = flow.module(moduleId)
  const value = mod?.config[settingKey] ?? def.default
  const [local, setLocal] = useState(String(value))

  const commit = (raw: string) => {
    setLocal(raw)
    if (def.type === 'number') {
      const n = Number(raw)
      if (!isNaN(n)) setFlowSetting(moduleId, settingKey, n)
    } else if (def.type === 'boolean') {
      setFlowSetting(moduleId, settingKey, raw === 'true')
    } else {
      setFlowSetting(moduleId, settingKey, raw)
    }
  }

  if (def.type === 'boolean') {
    return (
      <label className="flex items-center justify-between">
        <span className="text-xs text-base-content/60">{def.label}</span>
        <input type="checkbox" className="toggle toggle-xs toggle-primary"
          checked={value === true || value === 'true'}
          onChange={e => commit(String(e.target.checked))} />
      </label>
    )
  }

  return (
    <label className="space-y-0.5">
      <span className="text-xs text-base-content/60">{def.label}</span>
      <input type={def.type === 'number' ? 'number' : 'text'} value={local}
        onChange={e => commit(e.target.value)}
        className="input input-bordered input-xs w-full font-mono text-xs" />
    </label>
  )
}

function SettingsPage() {
  const toggleFlowModule = useApp(s => s.toggleFlowModule)
  const flowModules = flow.modules()

  return (
    <div className="space-y-6">
      {flowModules.map(mod => (
        <div key={mod.def.id} className="bg-base-100 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-bold">{mod.def.label}</span>
              <span className="text-[10px] text-base-content/30 ml-2">{mod.def.id}</span>
            </div>
            <input type="checkbox" className="toggle toggle-sm toggle-primary"
              checked={mod.enabled}
              onChange={() => toggleFlowModule(mod.def.id)} />
          </div>

          {mod.enabled && Object.keys(mod.def.settings).length > 0 && (
            <div className="space-y-2 border-t border-base-300 pt-3">
              {Object.entries(mod.def.settings).map(([key, def]) => (
                <SettingField key={key} moduleId={mod.def.id} settingKey={key} def={def} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const GearIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
)

registerModule({
  id: 'settings',
  label: 'Ustawienia',
  icon: GearIcon,
  type: 'page',
  Component: SettingsPage,
})
