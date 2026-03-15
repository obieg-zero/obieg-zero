import { registerPlugin, isPluginEnabled, type PluginDef, type PluginFactory, type PluginDeps, type PluginManifest, type InstalledPlugin, type RegistryIndex, type UpdateInfo } from '@obieg-zero/plugin-sdk'

const PLUGINS_DIR = '__plugins__'
const REGISTRY_URL = 'https://raw.githubusercontent.com/obieg-zero/plugin-registry/main/index.json'
const REGISTRY_CACHE_KEY = 'oz-registry-cache'
const REGISTRY_TTL = 3600_000 // 1 hour
const TOKEN_KEY = 'oz-gh-token'

// --- OPFS helpers ---

async function getPluginsRoot(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(PLUGINS_DIR, { create: true })
}

async function writeOPFS(dir: FileSystemDirectoryHandle, name: string, data: string | Uint8Array): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  const blob = typeof data === 'string' ? new Blob([data]) : new Blob([data.buffer as ArrayBuffer])
  await w.write(blob)
  await w.close()
}

async function readOPFS(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  const fh = await dir.getFileHandle(name)
  const file = await fh.getFile()
  return file.text()
}

async function removeDir(parent: FileSystemDirectoryHandle, name: string): Promise<void> {
  await parent.removeEntry(name, { recursive: true })
}

// --- Manifest validation ---

export function validateManifest(json: unknown): json is PluginManifest {
  if (!json || typeof json !== 'object') return false
  const m = json as Record<string, unknown>
  if (typeof m.id !== 'string' || !/^[a-z0-9-]+$/.test(m.id)) return false
  if (typeof m.label !== 'string' || !m.label) return false
  if (typeof m.description !== 'string' || !m.description) return false
  if (typeof m.version !== 'string' || !/^\d+\.\d+\.\d+/.test(m.version)) return false
  if (typeof m.author !== 'string' || !m.author) return false
  return true
}

// --- GitHub token ---

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

// --- Registry ---

export async function fetchRegistry(opts?: { force?: boolean }): Promise<RegistryIndex> {
  if (!opts?.force) {
    try {
      const cached = localStorage.getItem(REGISTRY_CACHE_KEY)
      if (cached) {
        const { data, fetchedAt } = JSON.parse(cached)
        if (Date.now() - fetchedAt < REGISTRY_TTL) return data
      }
    } catch { /* corrupt cache */ }
  }
  const resp = await fetch(REGISTRY_URL)
  if (!resp.ok) throw new Error(`Registry: HTTP ${resp.status}`)
  const data: RegistryIndex = await resp.json()
  localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }))
  return data
}

export async function checkUpdates(): Promise<UpdateInfo[]> {
  const [installed, registry] = await Promise.all([listInstalled(), fetchRegistry()])
  const updates: UpdateInfo[] = []
  for (const p of installed) {
    const reg = registry.plugins.find(r => r.id === p.id)
    if (reg && reg.version !== p.version) {
      updates.push({ pluginId: p.id, installedVersion: p.version, registryVersion: reg.version })
    }
  }
  return updates
}

// --- Install ---

function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } {
  // Accept both "obieg-zero/plugin-name" and full URLs
  const short = url.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (short) return { owner: short[1], repo: short[2], branch: 'main' }
  const cleaned = url.replace(/\/$/, '').replace(/\.git$/, '')
  const m = cleaned.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?/)
  if (!m) throw new Error('Nie rozpoznano URL GitHub: ' + url)
  return { owner: m[1], repo: m[2], branch: m[3] || 'main' }
}

export async function installFromGitHub(repoUrl: string, token?: string): Promise<InstalledPlugin> {
  const { owner, repo, branch } = parseGitHubUrl(repoUrl)
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`
  const headers: HeadersInit = token ? { Authorization: `token ${token}` } : {}

  const manifestResp = await fetch(`${base}/manifest.json`, { headers })
  if (manifestResp.status === 401 || manifestResp.status === 403) throw new Error('Brak dostepu — sprawdz token GitHub')
  if (!manifestResp.ok) throw new Error(`Brak manifest.json w ${repoUrl}`)
  const raw = await manifestResp.json()

  if (!validateManifest(raw)) throw new Error(`Nieprawidlowy manifest.json w ${repoUrl}`)

  const manifest: InstalledPlugin = {
    ...raw,
    repo: `${owner}/${repo}`,
    installedAt: new Date().toISOString(),
    installedFrom: 'github',
  }

  const entry = manifest.entry || 'index.mjs'
  const codeResp = await fetch(`${base}/${entry}`, { headers })
  if (!codeResp.ok) throw new Error(`Brak ${entry} w ${repoUrl}`)
  const code = await codeResp.text()

  const root = await getPluginsRoot()
  const dir = await root.getDirectoryHandle(manifest.id, { create: true })
  await writeOPFS(dir, 'manifest.json', JSON.stringify(manifest))
  await writeOPFS(dir, entry, code)

  registerPlugin(manifest as unknown as PluginDef)
  return manifest
}

export async function installFromZip(file: File): Promise<InstalledPlugin> {
  // @ts-ignore — fflate is a peer dep, loaded dynamically
  const { unzipSync } = await import('fflate') as { unzipSync: (data: Uint8Array) => Record<string, Uint8Array> }
  const buffer = await file.arrayBuffer()
  const files = unzipSync(new Uint8Array(buffer))

  let prefix = ''
  const keys = Object.keys(files)
  const manifestKey: string = keys.find(k => k === 'manifest.json')
    || keys.find(k => k.endsWith('/manifest.json') && k.split('/').length === 2)
    || ''
  if (!manifestKey) throw new Error('Brak manifest.json w ZIP')
  if (manifestKey.includes('/')) prefix = manifestKey.slice(0, manifestKey.lastIndexOf('/') + 1)

  const decoder = new TextDecoder()
  const raw = JSON.parse(decoder.decode(files[manifestKey]))
  if (!validateManifest(raw)) throw new Error('Nieprawidlowy manifest.json w ZIP')

  const manifest: InstalledPlugin = {
    ...raw,
    installedAt: new Date().toISOString(),
    installedFrom: 'zip',
  }

  const root = await getPluginsRoot()
  const dir = await root.getDirectoryHandle(manifest.id, { create: true })

  for (const [path, bytes] of Object.entries(files) as [string, Uint8Array][]) {
    if (path.endsWith('/')) continue
    const name = prefix ? path.replace(prefix, '') : path
    if (!name) continue
    await writeOPFS(dir, name, bytes)
  }

  // Overwrite manifest with install metadata
  await writeOPFS(dir, 'manifest.json', JSON.stringify(manifest))

  registerPlugin(manifest as unknown as PluginDef)
  return manifest
}

export async function installFromUrl(url: string): Promise<InstalledPlugin> {
  if (url.includes('github.com/') || /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(url)) {
    return installFromGitHub(url, getToken() || undefined)
  }
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`)
  const blob = await resp.blob()
  const file = new File([blob], 'plugin.zip', { type: 'application/zip' })
  return installFromZip(file)
}

export async function updatePlugin(pluginId: string, token?: string): Promise<InstalledPlugin> {
  const installed = await listInstalled()
  const current = installed.find(p => p.id === pluginId)
  if (!current?.repo) throw new Error(`Plugin ${pluginId} nie ma repo — nie mozna zaktualizowac`)
  await uninstallPlugin(pluginId)
  return installFromGitHub(current.repo, token)
}

// --- List / Uninstall ---

export async function listInstalled(): Promise<InstalledPlugin[]> {
  const root = await getPluginsRoot()
  const result: InstalledPlugin[] = []
  for await (const [, handle] of (root as any).entries()) {
    if (handle.kind !== 'directory') continue
    try {
      const json = await readOPFS(handle, 'manifest.json')
      result.push(JSON.parse(json))
    } catch { /* skip broken plugins */ }
  }
  return result
}

export async function uninstallPlugin(pluginId: string): Promise<void> {
  const root = await getPluginsRoot()
  await removeDir(root, pluginId)
}

// --- Load at boot ---

export async function loadInstalledPlugins(deps: PluginDeps): Promise<void> {
  const root = await getPluginsRoot()
  const entries: { manifest: InstalledPlugin; dir: FileSystemDirectoryHandle }[] = []

  for await (const [, handle] of (root as any).entries()) {
    if (handle.kind !== 'directory') continue
    try {
      const json = await readOPFS(handle, 'manifest.json')
      const manifest: InstalledPlugin = JSON.parse(json)
      registerPlugin(manifest as unknown as PluginDef)
      entries.push({ manifest, dir: handle })
    } catch { /* skip */ }
  }

  const loads = entries
    .filter(e => isPluginEnabled(e.manifest.id))
    .map(async ({ manifest, dir }) => {
      try {
        const entry = manifest.entry || 'index.mjs'
        const code = await readOPFS(dir, entry)
        const blob = new Blob([code], { type: 'application/javascript' })
        const blobUrl = URL.createObjectURL(blob)
        const mod = await import(/* @vite-ignore */ blobUrl)
        const factory: PluginFactory = mod.default
        if (typeof factory !== 'function') return
        const def = factory(deps)
        if (def) registerPlugin(def)
        if (def?.setup) def.setup()
      } catch (err) {
        console.error(`[plugin-sdk] installed/${manifest.id}:`, err)
      }
    })

  await Promise.all(loads)
}
