import { Settings } from 'react-feather'
import type { PluginFactory } from '@obieg-zero/plugin-sdk'
import { getProfile, getAllPlugins } from '@obieg-zero/plugin-sdk'
import { Cell } from '../components/Box'

function exportConfig() {
  const profile = getProfile()
  const plugins: Record<string, boolean> = {}
  for (const p of getAllPlugins()) { if (!p.alwaysOn) plugins[p.id] = profile[p.id] !== false }
  const activeId = localStorage.getItem('bp-active') || undefined
  const config = { plugins, defaultPlugin: activeId }
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'config.json'
  a.click()
  URL.revokeObjectURL(a.href)
}

const configExportPlugin: PluginFactory = () => ({
  id: 'config-export',
  label: 'Eksport config',
  description: 'Pobierz config.json do redystrybucji',
  alwaysOn: true,
  action: <Cell onClick={exportConfig}><Settings size={16} /></Cell>,
})

export default configExportPlugin
