import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { Upload, FileText, Layers, Cpu, Globe, GitBranch, Check, AlertCircle } from 'react-feather'

const ICONS: Record<string, any> = { upload: Upload, parse: FileText, embed: Layers, extract: Cpu, 'extract-api': Globe, graph: GitBranch }
const DOT: Record<string, string> = { running: 'bg-warning', done: 'bg-success', error: 'bg-error' }

function NodeShell({ id, data, children }: { id: string; data: any; children?: React.ReactNode }) {
  const { updateNodeData } = useReactFlow()
  const cfg = data.config && Object.keys(data.config).length > 0 ? Object.entries(data.config) : null
  const onCfg = (k: string, v: string) => updateNodeData(id, { config: { ...data.config, [k]: v } })
  const Icon = ICONS[data._blockType] || FileText
  const err = data.status === 'error'
  const done = data.status === 'done'

  return (
    <div className="bg-base-200 rounded-lg p-4 min-w-52 max-w-72">
      <Handle type="target" position={Position.Top} />

      {/* header — icon + label + status, mb-3 like doc-analyzer */}
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={done ? 'text-success' : err ? 'text-error' : undefined} />
        <span className="font-medium text-xs">{data.label}</span>
        {data.status === 'running' && <span className="loading loading-spinner loading-xs" />}
        {done && <Check size={12} className="text-success shrink-0" />}
        {err && <AlertCircle size={12} className="text-error shrink-0" />}
      </div>

      {/* result row — bg-base-300 rounded, like doc rows */}
      {data.result && (
        <div className={`flex items-center gap-2 rounded-md px-3 py-2 mb-2 ${err ? 'bg-error/10' : 'bg-base-300'}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[data.status] || 'bg-base-content/20'}`} />
          <span className={`text-xs flex-1 ${err ? 'text-error' : 'text-base-content/50'}`}>{data.result}</span>
        </div>
      )}

      {children}

      {/* config — expandable */}
      {cfg && <details>
        <summary className="text-2xs text-base-content/20 cursor-pointer hover:text-base-content/40 transition-colors select-none mt-2">config</summary>
        <div className="mt-2 space-y-1">{cfg.map(([k, v]) => (
          <div key={k} className="bg-base-300 rounded-md px-3 py-2">
            <div className="text-2xs text-base-content/30 mb-1">{k}</div>
            {String(v).includes('\n') || String(v).length > 50
              ? <textarea value={String(v)} rows={2} onChange={e => onCfg(k, e.target.value)}
                  className="textarea textarea-bordered textarea-sm font-mono w-full bg-transparent border-base-300" />
              : <input type={k === 'apiKey' ? 'password' : 'text'} value={String(v)}
                  placeholder={k === 'apiKey' ? 'sk-...' : ''}
                  onChange={e => onCfg(k, e.target.value)}
                  className="input input-bordered input-sm w-full text-xs font-mono bg-transparent border-base-300" />}
          </div>
        ))}</div>
      </details>}

      <Handle type="source" position={Position.Bottom} id="next" />
      <Handle type="source" position={Position.Right} id="data" style={{ background: 'color-mix(in oklch, var(--color-base-content) 30%, transparent)' }} />
      <Handle type="source" position={Position.Left} id="data-left" style={{ background: 'color-mix(in oklch, var(--color-base-content) 30%, transparent)' }} />
    </div>
  )
}

function UploadNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  return (
    <NodeShell id={id} data={{ ...data, _blockType: 'upload' }}>
      <label className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 cursor-pointer transition-colors
        ${data._fileNames ? 'bg-base-300' : 'bg-base-300/50 border border-dashed border-base-300 hover:bg-base-300'}`}>
        {data._fileNames
          ? <><FileText size={12} className="shrink-0 text-base-content/40" /><span className="text-xs text-base-content/50 truncate">{data._fileNames as string}</span></>
          : <><Upload size={12} className="text-base-content/30" /><span className="text-2xs text-base-content/30">wybierz pliki</span></>}
        <input type="file" accept=".pdf,.csv,.tsv,.txt,.json" multiple hidden onChange={e => {
          const f = Array.from(e.target.files || [])
          if (f.length) updateNodeData(id, { _files: f, _fileNames: f.map(x => x.name).join(', ') })
        }} />
      </label>
    </NodeShell>
  )
}

function DataNode({ data }: NodeProps) {
  return (
    <div className="flex items-center gap-2 bg-base-300 rounded-md px-3 py-2 w-48 overflow-hidden">
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <FileText size={12} className="shrink-0 text-base-content/40" />
      <span className="text-xs truncate flex-1 min-w-0">{data.label as string}</span>
      {'detail' in data && data.detail ? <span className="text-2xs text-base-content/30 truncate max-w-20">{String(data.detail)}</span> : null}
    </div>
  )
}

function EntityNode({ data }: NodeProps) {
  const shared = data.shared as boolean
  return (
    <div className={`flex items-center gap-2 rounded-md px-3 py-2 w-56 overflow-hidden ${shared ? 'bg-primary/15 ring-1 ring-primary/30' : 'bg-base-300'}`}>
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <span className={`w-2 h-2 rounded-full shrink-0 ${shared ? 'bg-primary' : 'bg-base-content/20'}`} />
      <span className="text-xs truncate flex-1 min-w-0">{data.label as string}</span>
      <span className="text-2xs text-base-content/30 truncate max-w-24">{data.detail as string}</span>
    </div>
  )
}

function DocNode({ data }: NodeProps) {
  return (
    <div className="flex items-center gap-2 bg-base-200 ring-1 ring-base-300 rounded-md px-3 py-2 w-48 overflow-hidden">
      <Handle type="source" position={Position.Right} id="right" />
      <FileText size={12} className="shrink-0 text-base-content/40" />
      <span className="text-xs font-medium truncate flex-1 min-w-0">{data.label as string}</span>
    </div>
  )
}

const mkNode = (blockType: string) =>
  ({ id, data }: NodeProps) => <NodeShell id={id} data={{ ...data, _blockType: blockType }} />

export const nodeTypes = {
  upload: UploadNode,
  parse: mkNode('parse'),
  embed: mkNode('embed'),
  extract: mkNode('extract'),
  'extract-api': mkNode('extract-api'),
  graph: mkNode('graph'),
  data: DataNode,
  entity: EntityNode,
  doc: DocNode,
}
