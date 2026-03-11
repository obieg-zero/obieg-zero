import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { Upload, FileText, Layers, Cpu, Globe, GitBranch } from 'react-feather'

const ICONS: Record<string, any> = { upload: Upload, parse: FileText, embed: Layers, extract: Cpu, 'extract-api': Globe, graph: GitBranch }
const DOT: Record<string, string> = { running: 'bg-warning', done: 'bg-success', error: 'bg-error' }

function Shell({ id, data, children }: { id: string; data: any; children?: React.ReactNode }) {
  const { updateNodeData } = useReactFlow()
  const cfg = data.config && Object.keys(data.config).length > 0 ? Object.entries(data.config) : null
  const onCfg = (k: string, v: string) => updateNodeData(id, { config: { ...data.config, [k]: v } })
  const Icon = ICONS[data._blockType] || FileText

  return (
    <div className="bg-base-200 rounded-lg min-w-48 max-w-64">
      <Handle type="target" position={Position.Top} />

      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-base-300/50">
        <div className={`w-2 h-2 rounded-full shrink-0 ${DOT[data.status] || 'bg-base-content/15'}`} />
        <Icon size={12} className="text-base-content/40 shrink-0" />
        <span className="text-xs font-semibold flex-1 truncate">{data.label}</span>
        {data.status === 'running' && <span className="loading loading-spinner loading-xs text-warning" />}
      </div>

      {/* result */}
      {data.result && (
        <div className={`px-3 py-2 text-2xs leading-relaxed ${data.status === 'error' ? 'text-error/80' : 'text-base-content/50'}`}>
          {data.result}
        </div>
      )}

      {children}

      {/* config */}
      {cfg && <details className="border-t border-base-300/30">
        <summary className="px-3 py-1.5 text-2xs text-base-content/20 cursor-pointer hover:text-base-content/40 transition-colors select-none">config</summary>
        <div className="px-3 pb-2.5 space-y-2">{cfg.map(([k, v]) => (
          <label key={k} className="form-control">
            <span className="text-2xs text-base-content/30 mb-0.5">{k}</span>
            {String(v).includes('\n') || String(v).length > 50
              ? <textarea value={String(v)} rows={2} onChange={e => onCfg(k, e.target.value)}
                  className="textarea textarea-bordered textarea-xs font-mono w-full bg-base-300/50" />
              : <input type={k === 'apiKey' ? 'password' : 'text'} value={String(v)}
                  placeholder={k === 'apiKey' ? 'sk-...' : ''}
                  onChange={e => onCfg(k, e.target.value)}
                  className="input input-bordered input-xs w-full text-2xs bg-base-300/50" />}
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
        <label className="btn btn-xs btn-ghost w-full gap-1.5 bg-base-300/50 hover:bg-base-300 border border-dashed border-base-content/10">
          <Upload size={12} className="text-base-content/40" />
          <span className="text-2xs text-base-content/50">wybierz pliki</span>
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
    <div className="bg-base-300 rounded px-3 py-1.5 max-w-44">
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-base-content/15 shrink-0" />
        <span className="text-2xs font-medium text-base-content/60 truncate">{data.label as string}</span>
      </div>
      {data.detail && <div className="text-2xs text-base-content/25 truncate ml-3">{data.detail as string}</div>}
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
