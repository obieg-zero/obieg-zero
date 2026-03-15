import { registerPlugin, isPluginEnabled, type PluginDef, type PluginFactory, type PluginDeps, type PluginManifest } from '@obieg-zero/plugin-sdk'

const PLUGINS_DIR = '__plugins__'
const REGISTRY_URL = 'https://raw.githubusercontent.com/obieg-zero/plugin-registry/main/index.json'

let _deps: PluginDeps | null = null
export function initInstaller(deps: PluginDeps) { _deps = deps }

async function loadPlugin(code: string, manifest: PluginManifest) {
  if (!_deps) return
  try {
    const mod = await import(/* @vite-ignore */ URL.createObjectURL(new Blob([code], { type: 'application/javascript' })))
    if (typeof mod.default !== 'function') return
    const def = mod.default(_deps)
    if (def) registerPlugin(def)
    if (def?.setup) def.setup()
  } catch (err) { console.error(`[plugin] ${manifest.id}:`, err) }
}

// --- OPFS helpers ---

async function getPluginsRoot(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(PLUGINS_DIR, { create: true })
}

async function writeOPFS(dir: FileSystemDirectoryHandle, name: string, data: string | Uint8Array): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(typeof data === 'string' ? new Blob([data]) : new Blob([data.buffer as ArrayBuffer]))
  await w.close()
}

async function readOPFS(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  const fh = await dir.getFileHandle(name)
  return (await fh.getFile()).text()
}

// --- Registry ---

export async function fetchRegistry(): Promise<PluginManifest[]> {
  const resp = await fetch(REGISTRY_URL)
  if (!resp.ok) throw new Error(`Registry: HTTP ${resp.status}`)
  const data = await resp.json()
  return data.plugins || []
}

// --- Install / Uninstall ---

function parseRepo(url: string): { owner: string; repo: string } {
  const short = url.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (short) return { owner: short[1], repo: short[2] }
  const m = url.replace(/\/$/, '').replace(/\.git$/, '').match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!m) throw new Error('Nie rozpoznano URL: ' + url)
  return { owner: m[1], repo: m[2] }
}

export async function install(repoUrl: string): Promise<PluginManifest> {
  const { owner, repo } = parseRepo(repoUrl)
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/main`

  const manifest: PluginManifest = await (await fetch(`${base}/manifest.json`)).json()
  if (!manifest.id || !manifest.version) throw new Error('Nieprawidlowy manifest.json')
  manifest.repo = `${owner}/${repo}`

  const entry = manifest.entry || 'index.mjs'
  const code = await (await fetch(`${base}/${entry}`)).text()

  const root = await getPluginsRoot()
  const dir = await root.getDirectoryHandle(manifest.id, { create: true })
  await writeOPFS(dir, 'manifest.json', JSON.stringify(manifest))
  await writeOPFS(dir, entry, code)

  registerPlugin(manifest as unknown as PluginDef)
  await loadPlugin(code, manifest)
  return manifest
}

export async function installFromZip(file: File): Promise<PluginManifest> {
  // @ts-ignore — fflate loaded dynamically
  const { unzipSync } = await import('fflate') as { unzipSync: (data: Uint8Array) => Record<string, Uint8Array> }
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()))

  const keys = Object.keys(files)
  const manifestKey = keys.find(k => k === 'manifest.json')
    || keys.find(k => k.endsWith('/manifest.json') && k.split('/').length === 2) || ''
  if (!manifestKey) throw new Error('Brak manifest.json w ZIP')
  const prefix = manifestKey.includes('/') ? manifestKey.slice(0, manifestKey.lastIndexOf('/') + 1) : ''

  const manifest: PluginManifest = JSON.parse(new TextDecoder().decode(files[manifestKey]))
  if (!manifest.id || !manifest.version) throw new Error('Nieprawidlowy manifest.json')

  const root = await getPluginsRoot()
  const dir = await root.getDirectoryHandle(manifest.id, { create: true })
  for (const [path, bytes] of Object.entries(files) as [string, Uint8Array][]) {
    if (path.endsWith('/')) continue
    const name = prefix ? path.replace(prefix, '') : path
    if (name) await writeOPFS(dir, name, bytes)
  }

  registerPlugin(manifest as unknown as PluginDef)
  const entryName = manifest.entry || 'index.mjs'
  const entryKey = Object.keys(files).find(k => k === prefix + entryName || k === entryName)
  if (entryKey) await loadPlugin(new TextDecoder().decode(files[entryKey]), manifest)
  return manifest
}

export async function uninstall(pluginId: string): Promise<void> {
  const root = await getPluginsRoot()
  await root.removeEntry(pluginId, { recursive: true })
}

// --- List installed ---

export async function listInstalled(): Promise<PluginManifest[]> {
  const root = await getPluginsRoot()
  const result: PluginManifest[] = []
  for await (const [, handle] of (root as any).entries()) {
    if (handle.kind !== 'directory') continue
    try { result.push(JSON.parse(await readOPFS(handle, 'manifest.json'))) } catch {}
  }
  return result
}

// --- Load at boot ---

export async function loadInstalledPlugins(deps: PluginDeps): Promise<void> {
  const root = await getPluginsRoot()
  const entries: { manifest: PluginManifest; dir: FileSystemDirectoryHandle }[] = []

  for await (const [, handle] of (root as any).entries()) {
    if (handle.kind !== 'directory') continue
    try {
      const manifest: PluginManifest = JSON.parse(await readOPFS(handle, 'manifest.json'))
      registerPlugin(manifest as unknown as PluginDef)
      entries.push({ manifest, dir: handle })
    } catch {}
  }

  await Promise.all(entries.filter(e => isPluginEnabled(e.manifest.id)).map(async ({ manifest, dir }) => {
    try {
      const code = await readOPFS(dir, manifest.entry || 'index.mjs')
      const mod = await import(/* @vite-ignore */ URL.createObjectURL(new Blob([code], { type: 'application/javascript' })))
      if (typeof mod.default !== 'function') return
      const def = mod.default(deps)
      if (def) registerPlugin(def)
      if (def?.setup) def.setup()
    } catch (err) { console.error(`[plugin] ${manifest.id}:`, err) }
  }))
}
