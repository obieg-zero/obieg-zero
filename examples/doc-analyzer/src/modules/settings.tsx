import { registerModule } from '../modules.ts'
import { modules } from '../modules.ts'
import { useApp } from '../store.ts'

function SettingsPage() {
  const enabledModules = useApp(s => s.enabledModules)
  const toggleModule = useApp(s => s.toggleModule)

  const toggleable = modules.filter(m => m.id !== 'settings')

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-widest text-base-content/40">Moduły</h2>
      <div className="space-y-1">
        {toggleable.map(m => {
          const Icon = m.icon
          const enabled = enabledModules.includes(m.id)
          return (
            <label key={m.id} className="flex items-center gap-3 p-2 rounded hover:bg-base-100 cursor-pointer">
              <input type="checkbox" className="toggle toggle-sm toggle-primary"
                checked={enabled} onChange={() => toggleModule(m.id)} />
              <Icon className="w-4 h-4 opacity-40" />
              <span className="text-sm">{m.label}</span>
              <span className="text-xs text-base-content/30 ml-auto">{m.type}</span>
            </label>
          )
        })}
      </div>
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
