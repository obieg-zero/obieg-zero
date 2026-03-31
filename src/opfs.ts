// ── OPFS Plugin Cache + Meta ────────────────────────────────────────

export const shouldCache = (spec: string) =>
  spec.startsWith('store://') || /^.+@v\d+\.\d+\.\d+/.test(spec)

const toKey = (spec: string) => spec.replace(/[^a-zA-Z0-9_@.-]/g, '_')

let _dir: FileSystemDirectoryHandle | null = null
const getDir = async () =>
  _dir ??= await (await navigator.storage.getDirectory())
    .getDirectoryHandle('plugin-cache', { create: true })

export const readCode = async (spec: string): Promise<string | null> => {
  try { return await (await (await getDir()).getFileHandle(toKey(spec))).getFile().then(f => f.text()) }
  catch { return null }
}

export const writeCode = async (spec: string, data: string) => {
  const fh = await (await getDir()).getFileHandle(toKey(spec), { create: true })
  const w = await fh.createWritable(); await w.write(data); await w.close()
}

export type PluginMeta = { specs: string[]; labels: Record<string, string>; licenseKey?: string }

let _m: PluginMeta = { specs: [], labels: {} }
export const meta = () => _m

export const loadMeta = async () => {
  try {
    const fh = await (await getDir()).getFileHandle('meta.json')
    Object.assign(_m, JSON.parse(await (await fh.getFile()).text()))
  } catch {}
  return _m
}

export const saveMeta = async () => {
  const fh = await (await getDir()).getFileHandle('meta.json', { create: true })
  const w = await fh.createWritable(); await w.write(JSON.stringify(_m)); await w.close()
}
