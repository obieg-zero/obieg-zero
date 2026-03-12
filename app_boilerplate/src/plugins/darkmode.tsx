import { useState, useEffect } from 'react'
import { Sun, Moon } from 'react-feather'
import type { PluginFactory } from '@obieg-zero/plugin-sdk'
import { Cell } from '../components/Box'

const STORAGE_KEY = 'bp-theme'
const DARK = 'dracula'
const LIGHT = 'corporate'

const darkmodePlugin: PluginFactory = (sdk) => {
  function ThemeToggle() {
    const [dark, setDark] = useState(() => (localStorage.getItem(STORAGE_KEY) ?? DARK) === DARK)

    useEffect(() => {
      const theme = dark ? DARK : LIGHT
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem(STORAGE_KEY, theme)
    }, [dark])

    return <Cell onClick={() => setDark(d => !d)}>{dark ? <Sun size={16} /> : <Moon size={16} />}</Cell>
  }

  sdk.registerManifest({ id: 'darkmode', label: 'Dark mode', description: 'Przełącznik dark/light' })
  sdk.addFilter('shell:actions', (actions: any[]) => [...actions, { pluginId: 'darkmode', node: <ThemeToggle /> }], 10, 'darkmode')
}

export default darkmodePlugin
