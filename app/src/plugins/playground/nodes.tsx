import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { Upload, FileText, Layers, Cpu, Globe, GitBranch, Filter, Shield, Check, AlertCircle } from 'react-feather'

const ICONS: Record<string, any> = { upload: Upload, embed: Layers, extract: Cpu, 'extract-api': Globe, graph: GitBranch, filter: Filter, validate: Shield }

function Status({ status }: { status?: string }) {
  if (status === 'running') return <span className="loading loading-spinner loading-xs" />
  if (status === 'done') return <Check size={12} className="text-success shrink-0" />
  if (status === 'error') return <AlertCircle size={12} className="text-error shrink-0" />
  return null
}

function BlockNode({ data }: NodeProps) {
  const bt = data._blockType as string
  const Icon = ICONS[bt] || FileText
  const err = data.status === 'error', done = data.status === 'done'
  const sub = (data.config as any)?.docGroup || data.result
  return (
    <div className="bg-base-200 rounded-lg px-4 py-3 min-w-40">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Icon size={14} className={done ? 'text-success' : err ? 'text-error' : 'text-base-content/50'} />
        <span className="font-medium text-xs">{data.label as string}</span>
        <Status status={data.status as string} />
      </div>
      {sub && <div className={`text-2xs mt-1 truncate max-w-48 ${err ? 'text-error' : 'text-base-content/40'}`}>{sub as string}</div>}
      <Handle type="source" position={Position.Bottom} id="next" />
      <Handle type="source" position={Position.Right} id="data" style={{ background: 'color-mix(in oklch, var(--color-base-content) 30%, transparent)' }} />
      <Handle type="source" position={Position.Left} id="data-left" style={{ background: 'color-mix(in oklch, var(--color-base-content) 30%, transparent)' }} />
    </div>
  )
}

function UploadNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const Icon = ICONS.upload
  const err = data.status === 'error', done = data.status === 'done'
  const group = (data.config as any)?.docGroup
  return (
    <div className="bg-base-200 rounded-lg px-4 py-3 min-w-40">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <Icon size={14} className={done ? 'text-success' : err ? 'text-error' : 'text-base-content/50'} />
        <span className="font-medium text-xs">{group || data.label as string}</span>
        <Status status={data.status as string} />
      </div>
      {'result' in data && data.result ? <div className={`text-2xs mt-1 ${err ? 'text-error' : 'text-base-content/40'}`}>{String(data.result)}</div> : null}
      <label className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 mt-2 cursor-pointer transition-colors
        ${data._fileNames ? 'bg-base-300' : 'bg-base-300/50 border border-dashed border-base-300 hover:bg-base-300'}`}>
        {data._fileNames
          ? <><FileText size={12} className="shrink-0 text-base-content/40" /><span className="text-xs text-base-content/50 truncate max-w-40">{data._fileNames as string}</span></>
          : <><Upload size={12} className="text-base-content/30" /><span className="text-2xs text-base-content/30">wybierz pliki</span></>}
        <input type="file" accept=".pdf,.csv,.tsv,.txt,.json" multiple hidden onChange={e => {
          const f = Array.from(e.target.files || [])
          if (f.length) updateNodeData(id, { _files: f, _fileNames: f.map(x => x.name).join(', ') })
        }} />
      </label>
      <Handle type="source" position={Position.Bottom} id="next" />
      <Handle type="source" position={Position.Right} id="data" style={{ background: 'color-mix(in oklch, var(--color-base-content) 30%, transparent)' }} />
      <Handle type="source" position={Position.Left} id="data-left" style={{ background: 'color-mix(in oklch, var(--color-base-content) 30%, transparent)' }} />
    </div>
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

const mk = (bt: string) => (props: NodeProps) => <BlockNode {...props} data={{ ...props.data, _blockType: bt }} />

export const nodeTypes = {
  upload: UploadNode,
  embed: mk('embed'),
  extract: mk('extract'),
  'extract-api': mk('extract-api'),
  graph: mk('graph'),
  filter: mk('filter'),
  validate: mk('validate'),
  data: DataNode,
  entity: EntityNode,
  doc: DocNode,
}
