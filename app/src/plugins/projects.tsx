import { useState, useSyncExternalStore } from 'react'
import { Plus, X } from 'react-feather'
import { doAction, registerProvider, type PluginFactory } from '@obieg-zero/plugin-sdk'
import { ListItem, Field } from '../themes'

export type ProjectsAPI = {
  useProjects: () => {
    projects: string[]; current: string | null
    select: (name: string) => void
    create: (name: string) => Promise<void>
    remove: (name: string) => Promise<void>
  }
  ProjectList: React.FC
}

const projectsPlugin: PluginFactory = (deps) => {
  const host = deps.host
  let state = { projects: [] as string[], current: null as string | null }
  const subs = new Set<() => void>()
  const emit = () => subs.forEach(fn => fn())
  function set(patch: Partial<typeof state>) { state = { ...state, ...patch }; emit() }

  host.opfs.listProjects().then((p: string[]) => set({ projects: p }))

  async function create(name: string) {
    const n = name.trim(); if (!n) return
    await host.opfs.createProject(n)
    await host.db.addProject({ id: n, name: n, createdAt: Date.now() }).catch(() => {})
    set({ projects: [...state.projects, n], current: n })
  }
  async function remove(name: string) {
    await host.opfs.removeProject(name).catch(() => {})
    await host.db.clearProject(name).catch(() => {})
    try { localStorage.removeItem(`pipeline:${name}`) } catch {}
    set({ projects: state.projects.filter(n => n !== name), current: state.current === name ? null : state.current })
  }
  function select(name: string) { set({ current: name }); doAction('shell:close-left') }

  function useProjects() {
    const snap = useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb) }, () => state)
    return { ...snap, select, create, remove }
  }

  function ProjectList() {
    const { projects, current, select, create, remove } = useProjects()
    const [name, setName] = useState('')
    return <>
      {projects.map(p => (
        <ListItem key={p} label={p} active={current === p} onClick={() => select(p)} action={{ icon: X, onClick: () => remove(p) }} />
      ))}
      <Field label="">
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { create(name.trim()); setName('') } }}
            placeholder="nowy projekt..." className="input input-bordered input-sm text-xs flex-1" />
          <button onClick={() => { if (name.trim()) { create(name.trim()); setName('') } }}
            className="btn btn-sm btn-primary text-xs"><Plus size={14} /></button>
        </div>
      </Field>
    </>
  }

  registerProvider('projects', { useProjects, ProjectList } as ProjectsAPI)

  return {
    id: 'projects',
    label: 'Projekty',
    description: 'Lista projektów OPFS',
  }
}

export default projectsPlugin
