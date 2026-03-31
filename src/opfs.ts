// ── OPFS Plugin Cache ───────────────────────────────────────────────
// Single source of truth for plugin state: code cache + meta.json.
// Przeżywa czyszczenie IndexedDB/localStorage.

export const shouldCache = (spec: string) =>
  spec.startsWith('store://') || /^.+@v\d+\.\d+\.\d+/.test(spec)

const encodeSpec = (spec: string) => btoa(spec).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const decodeSpec = (key: string) => atob(key.replace(/-/g, '+').replace(/_/g, '/'))

let _dir: FileSystemDirectoryHandle | null = null
const getDir = async () =>
  _dir ??= await (await navigator.storage.getDirectory())
    .getDirectoryHandle('plugin-cache', { create: true })

// ── Code cache ──────────────────────────────────────────────────────

export const opfsReadCode = async (spec: string): Promise<string | null> => {
  try {
    const fh = await (await getDir()).getFileHandle(`code--${encodeSpec(spec)}`)
    return await (await fh.getFile()).text()
  } catch { return null }
}

export const opfsWriteCode = async (spec: string, data: string): Promise<void> => {
  const fh = await (await getDir()).getFileHandle(`code--${encodeSpec(spec)}`, { create: true })
  const w = await fh.createWritable()
  await w.write(data)
  await w.close()
}

const opfsRemoveCode = async (spec: string): Promise<void> => {
  try { await (await getDir()).removeEntry(`code--${encodeSpec(spec)}`) } catch { /* ok */ }
}

// ── Meta (specs, labels, license) ───────────────────────────────────

export interface PluginMeta {
  specs: string[]
  labels: Record<string, string>
  licenseKey?: string
}

const EMPTY_META: PluginMeta = { specs: [], labels: {} }

export const opfsReadMeta = async (): Promise<PluginMeta> => {
  try {
    const fh = await (await getDir()).getFileHandle('meta.json')
    return { ...EMPTY_META, ...JSON.parse(await (await fh.getFile()).text()) }
  } catch { return { ...EMPTY_META } }
}

const opfsWriteMeta = async (meta: PluginMeta): Promise<void> => {
  const fh = await (await getDir()).getFileHandle('meta.json', { create: true })
  const w = await fh.createWritable()
  await w.write(JSON.stringify(meta))
  await w.close()
}

export const opfsAddPlugin = async (spec: string, label?: string): Promise<void> => {
  const meta = await opfsReadMeta()
  if (meta.specs.includes(spec)) return
  meta.specs.push(spec)
  if (label) meta.labels[spec] = label
  await opfsWriteMeta(meta)
}

export const opfsRemovePlugin = async (spec: string): Promise<void> => {
  const meta = await opfsReadMeta()
  meta.specs = meta.specs.filter(s => s !== spec)
  delete meta.labels[spec]
  await opfsWriteMeta(meta)
  await opfsRemoveCode(spec)
}

export const opfsSaveLicense = async (key: string): Promise<void> => {
  const meta = await opfsReadMeta()
  meta.licenseKey = key
  await opfsWriteMeta(meta)
}

export const opfsClear = async (): Promise<void> => {
  try {
    await (await navigator.storage.getDirectory())
      .removeEntry('plugin-cache', { recursive: true })
  } catch { /* nie istnieje — ok */ }
  _dir = null
}
