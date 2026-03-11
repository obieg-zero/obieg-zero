import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { Upload, FileText, Layers, Cpu, Globe, GitBranch, AlertCircle, Check } from 'react-feather'

const ICONS: Record<string, any> = { upload: Upload, parse: FileText, embed: Layers, extract: Cpu, 'extract-api': Globe, graph: GitBranch }

function Shell({ id, data, children }: { id: string; data: any; children?: React.ReactNode }) {
  const { updateNodeData } = useReactFlow()
  const err = data.status === 'error'
  const done = data.status === 'done'
  const border = err ? 'border-error/50' : done ? 'border-success/30' : 'border-base-300/50'
  const cfg = data.config && Object.keys(data.config).length > 0 ? Object.entries(data.config) : null
  const onCfg = (k: string, v: string) => updateNodeData(id, { config: { ...data.config, [k]: v } })
  const Icon = ICONS[data._blockType] || FileText

  return (
    <div className={`bg-base-100 border ${border} rounded-xl shadow-lg shadow-black/10 min-w-48 max-w-64`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-base-200/50">
        <Icon size={13} className={done ? 'text-success' : err ? 'text-error' : 'text-base-content/40'} />
        <span className="text-xs font-semibold flex-1">{data.label}</span>
        {data.status === 'running' && <span className="loading loading-spinner loading-xs text-primary" />}
        {done && <Check size={12} className="text-success" />}
        {err && <AlertCircle size={12} className="text-error" />}
      </div>
      {data.result && (
        <div className={`px-3 py-2 text-2xs leading-relaxed ${err ? 'text-error/80' : 'text-base-content/60'}`}>{data.result}</div>
      )}
      {children}
      {cfg && <details className="border-t border-base-200/30">
        <summary className="px-3 py-1.5 text-2xs text-base-content/25 cursor-pointer hover:text-base-content/40 transition-colors">config</summary>
        <div className="px-3 pb-2 space-y-1.5">{cfg.map(([k, v]) => (
          <label key={k} className="form-control">
            <span className="text-2xs text-base-content/30 mb-0.5">{k}</span>
            {String(v).includes('\n') || String(v).length > 50
              ? <textarea value={String(v)} rows={2} onChange={e => onCfg(k, e.target.value)} className="textarea textarea-bordered textarea-xs font-mono w-full" />
              : <input type={k === 'apiKey' ? 'password' : 'text'} value={String(v)} placeholder={k === 'apiKey' ? 'sk-...' : ''}
                  onChange={e => onCfg(k, e.target.value)} className="input input-bordered input-xs w-full text-2xs" />}
          </label>
        ))}</div>
      </details>}
      <Handle type="source" position={Position.Bottom} id="next" />
      <Handle type="source" position={Position.Right} id="data" style={{ background: '#6b7280' }} />
      <Handle type="source" position={Position.Left} id="data-left" style={{ background: '#6b7280' }} />
    </div>
  )
}

function UploadNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  return (
    <Shell id={id} data={{ ...data, _blockType: 'upload' }}>
      <div className="px-3 py-2">
        <label className="btn btn-xs btn-outline btn-primary w-full gap-1.5">
          <Upload size={12} />wybierz pliki
          <input type="file" accept=".pdf,.csv,.tsv,.txt,.json" multiple hidden onChange={e => {
            const f = Array.from(e.target.files || [])
            if (f.length) updateNodeData(id, { _files: f, _fileNames: f.map(x => x.name).join(', ') })
          }} />
        </label>
        {data._fileNames && <div className="text-2xs text-base-content/40 mt-1.5 truncate">{data._fileNames as string}</div>}
      </div>
    </Shell>
  )
}

function DataNode({ data }: NodeProps) {
  return (
    <div className="bg-base-200/60 border border-base-300/30 rounded-lg px-2.5 py-1.5 max-w-44">
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <div className="text-2xs font-medium text-base-content/70 truncate">{data.label as string}</div>
      {data.detail && <div className="text-2xs text-base-content/30 truncate">{data.detail as string}</div>}
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
