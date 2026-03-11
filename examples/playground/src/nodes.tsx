import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { Upload, FileText, Layers, Cpu, Globe, GitBranch, Check, AlertCircle } from 'react-feather'

const ICONS: Record<string, any> = { upload: Upload, parse: FileText, embed: Layers, extract: Cpu, 'extract-api': Globe, graph: GitBranch }
const STATUS_BADGE: Record<string, string> = { running: 'badge-warning', done: 'badge-success', error: 'badge-error' }

function Shell({ id, data, children }: { id: string; data: any; children?: React.ReactNode }) {
  const { updateNodeData } = useReactFlow()
  const cfg = data.config && Object.keys(data.config).length > 0 ? Object.entries(data.config) : null
  const onCfg = (k: string, v: string) => updateNodeData(id, { config: { ...data.config, [k]: v } })
  const Icon = ICONS[data._blockType] || FileText
  const err = data.status === 'error'
  const done = data.status === 'done'

  return (
    <div className="card card-compact bg-base-200 shadow-md min-w-52 max-w-72">
      <Handle type="target" position={Position.Top} />
      <div className="card-body gap-2">

        {/* header */}
        <div className="flex items-center gap-2">
          <Icon size={14} className={done ? 'text-success' : err ? 'text-error' : 'text-base-content/50'} />
          <span className="card-title text-xs flex-1">{data.label}</span>
          {data.status === 'running' && <span className="loading loading-spinner loading-xs" />}
          {done && <Check size={12} className="text-success shrink-0" />}
          {err && <AlertCircle size={12} className="text-error shrink-0" />}
        </div>

        {/* result */}
        {data.result && (
          <div className={`flex items-center gap-2 ${err ? 'text-error/80' : 'text-base-content/50'}`}>
            <span className={`badge badge-xs ${STATUS_BADGE[data.status] || 'badge-ghost'}`} />
            <span className="text-xs">{data.result}</span>
          </div>
        )}

        {children}

        {/* config */}
        {cfg && (
          <div className="collapse collapse-arrow bg-base-300 -mx-1">
            <input type="checkbox" className="min-h-0 peer" />
            <div className="collapse-title text-2xs text-base-content/30 min-h-0 py-1 px-3">config</div>
            <div className="collapse-content px-3 space-y-2">
              {cfg.map(([k, v]) => (
                <label key={k} className="form-control w-full">
                  <div className="label py-0"><span className="label-text text-2xs text-base-content/30">{k}</span></div>
                  {String(v).includes('\n') || String(v).length > 50
                    ? <textarea value={String(v)} rows={2} onChange={e => onCfg(k, e.target.value)}
                        className="textarea textarea-bordered textarea-sm font-mono w-full" />
                    : <input type={k === 'apiKey' ? 'password' : 'text'} value={String(v)}
                        placeholder={k === 'apiKey' ? 'sk-...' : ''}
                        onChange={e => onCfg(k, e.target.value)}
                        className="input input-bordered input-sm w-full text-xs font-mono" />}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} id="next" />
      <Handle type="source" position={Position.Right} id="data" />
      <Handle type="source" position={Position.Left} id="data-left" />
    </div>
  )
}

function UploadNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  return (
    <Shell id={id} data={{ ...data, _blockType: 'upload' }}>
      <label className={`btn btn-sm w-full gap-2 ${data._fileNames ? 'btn-ghost' : 'btn-outline btn-dashed'}`}>
        {data._fileNames
          ? <><FileText size={12} /><span className="truncate text-xs">{data._fileNames as string}</span></>
          : <><Upload size={12} /><span className="text-2xs">wybierz pliki</span></>}
        <input type="file" accept=".pdf,.csv,.tsv,.txt,.json" multiple hidden onChange={e => {
          const f = Array.from(e.target.files || [])
          if (f.length) updateNodeData(id, { _files: f, _fileNames: f.map(x => x.name).join(', ') })
        }} />
      </label>
    </Shell>
  )
}

function DataNode({ data }: NodeProps) {
  return (
    <div className="badge badge-lg badge-ghost gap-2 max-w-48">
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <FileText size={10} className="shrink-0" />
      <span className="text-xs truncate">{data.label as string}</span>
      {data.detail && <span className="text-2xs text-base-content/30">{data.detail as string}</span>}
    </div>
  )
}

const mkNode = (blockType: string) =>
  ({ id, data }: NodeProps) => <Shell id={id} data={{ ...data, _blockType: blockType }} />

export const nodeTypes = {
  upload: UploadNode,
  parse: mkNode('parse'),
  embed: mkNode('embed'),
  extract: mkNode('extract'),
  'extract-api': mkNode('extract-api'),
  graph: mkNode('graph'),
  data: DataNode,
}
