import { useState, useEffect } from 'react'
import { Menu, ChevronLeft, Sun, Moon, Sidebar, X } from 'react-feather'
import { Box, Cell } from './components/Box'

export function App() {
  const [dark, setDark] = useState(true)
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dracula' : 'corporate' }, [dark])

  return (
    <div className="h-screen overflow-hidden bg-base-200 text-sm text-base-content">
      <div className={`flex h-full transition-transform duration-300 ease-in-out ${leftOpen ? '' : 'max-md:-translate-x-72'}`}>
        <div className="w-72 shrink-0 border-r border-base-300 flex flex-col h-full min-h-0 divide-y divide-base-300">
          <Box header={<Cell label>projekty</Cell>} />
          <Box header={<Cell label>szablony</Cell>} />
        </div>
        <Box className="flex-1 max-md:min-w-[100vw]"
          header={<>
            <Cell className="md:hidden" onClick={() => { setLeftOpen(!leftOpen); if (!leftOpen) setRightOpen(false) }}>{leftOpen ? <ChevronLeft size={14} /> : <Menu size={14} />}</Cell>
            <Cell label>boilerplate</Cell>
            <Cell onClick={() => setDark(!dark)}>{dark ? <Sun size={14} /> : <Moon size={14} />}</Cell>
            <Cell onClick={() => setRightOpen(!rightOpen)}><Sidebar size={14} /></Cell>
          </>}
          footer={<Cell label><pre className="text-2xs text-base-content/30" data-prefix=">">[ready]</pre></Cell>}
        />
      </div>
      {rightOpen && (
        <Box className="w-72 shrink-0 border-l border-base-300 absolute right-0 top-0 bottom-0 z-40 shadow-lg"
          header={<><Cell label>right</Cell><Cell onClick={() => setRightOpen(false)}><X size={14} /></Cell></>}
        />
      )}
    </div>
  )
}
