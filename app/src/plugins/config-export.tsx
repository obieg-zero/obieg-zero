import { Settings } from 'react-feather'
import type { PluginFactory } from '@obieg-zero/plugin-sdk'
import { doAction, getProfile, getAllPlugins } from '@obieg-zero/plugin-sdk'
import { Cell } from '../components/Box'

const configExportPlugin: PluginFactory = (sdk) => {
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

  sdk.registerManifest({ id: 'config-export', label: 'Eksport config', description: 'Pobierz config.json do redystrybucji', alwaysOn: true })
  sdk.addFilter('shell:actions', (actions: any[]) => [...actions, {
    pluginId: 'config-export',
    node: <Cell onClick={exportConfig}><Settings size={16} /></Cell>
  }], 30, 'config-export')
}

export default configExportPlugin
