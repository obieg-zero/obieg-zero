import type { PluginManifestData, PluginFactory, SdkAPI, PluginDeps } from './types.js'
import { registerManifest, markReady } from './registry.js'
import { isPluginEnabled } from './profileStore.js'

const PLUGINS_DIR = '__plugins__'

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

// --- GitHub URL parser ---

function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } {
  const cleaned = url.replace(/\/$/, '').replace(/\.git$/, '')
  const m = cleaned.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?/)
  if (!m) throw new Error('Nie rozpoznano URL GitHub: ' + url)
  return { owner: m[1], repo: m[2], branch: m[3] || 'main' }
}

// --- Install sources ---

export async function installFromGitHub(repoUrl: string): Promise<PluginManifestData> {
  const { owner, repo, branch } = parseGitHubUrl(repoUrl)
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`

  const manifestResp = await fetch(`${base}/manifest.json`)
  if (!manifestResp.ok) throw new Error(`Brak manifest.json w ${repoUrl}`)
  const manifest: PluginManifestData & { entry?: string } = await manifestResp.json()

  const entry = manifest.entry || 'index.mjs'
  const codeResp = await fetch(`${base}/${entry}`)
  if (!codeResp.ok) throw new Error(`Brak ${entry} w ${repoUrl}`)
  const code = await codeResp.text()

  // save source info
  manifest.repo = repoUrl

  const root = await getPluginsRoot()
  const dir = await root.getDirectoryHandle(manifest.id, { create: true })
  await writeOPFS(dir, 'manifest.json', JSON.stringify(manifest))
  await writeOPFS(dir, entry, code)

  registerManifest(manifest)
  return manifest
}

export async function installFromZip(file: File): Promise<PluginManifestData> {
  // @ts-ignore — fflate is a peer dep, loaded dynamically
  const { unzipSync } = await import('fflate') as { unzipSync: (data: Uint8Array) => Record<string, Uint8Array> }
  const buffer = await file.arrayBuffer()
  const files = unzipSync(new Uint8Array(buffer))

  // find manifest.json (may be at root or one level deep)
  let prefix = ''
  const keys = Object.keys(files)
  const manifestKey: string = keys.find(k => k === 'manifest.json')
    || keys.find(k => k.endsWith('/manifest.json') && k.split('/').length === 2)
    || ''
  if (!manifestKey) throw new Error('Brak manifest.json w ZIP')
  if (manifestKey.includes('/')) prefix = manifestKey.slice(0, manifestKey.lastIndexOf('/') + 1)

  const decoder = new TextDecoder()
  const manifest: PluginManifestData = JSON.parse(decoder.decode(files[manifestKey]))

  const root = await getPluginsRoot()
  const dir = await root.getDirectoryHandle(manifest.id, { create: true })

  for (const [path, bytes] of Object.entries(files) as [string, Uint8Array][]) {
    if (path.endsWith('/')) continue // skip directories
    const name = prefix ? path.replace(prefix, '') : path
    if (!name) continue
    await writeOPFS(dir, name, bytes)
  }

  registerManifest(manifest)
  return manifest
}

export async function installFromUrl(url: string): Promise<PluginManifestData> {
  // GitHub URL → use GitHub flow
  if (url.includes('github.com/')) return installFromGitHub(url)

  // Otherwise treat as direct ZIP URL
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`)
  const blob = await resp.blob()
  const file = new File([blob], 'plugin.zip', { type: 'application/zip' })
  return installFromZip(file)
}

// --- List / uninstall ---

export async function listInstalled(): Promise<PluginManifestData[]> {
  const root = await getPluginsRoot()
  const result: PluginManifestData[] = []
  for await (const [name, handle] of (root as any).entries()) {
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

// --- Load installed plugins from OPFS ---

export async function loadInstalledPlugins(sdk: SdkAPI, deps: PluginDeps): Promise<void> {
  const root = await getPluginsRoot()
  const entries: { manifest: PluginManifestData; dir: FileSystemDirectoryHandle }[] = []

  for await (const [name, handle] of (root as any).entries()) {
    if (handle.kind !== 'directory') continue
    try {
      const json = await readOPFS(handle, 'manifest.json')
      const manifest: PluginManifestData & { entry?: string } = JSON.parse(json)
      registerManifest(manifest)
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
        await factory(sdk, deps)
        markReady(manifest.id)
      } catch (err) {
        console.error(`[plugin-sdk] installed/${manifest.id}:`, err)
      }
    })

  await Promise.all(loads)
}
