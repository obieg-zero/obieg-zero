import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'

function Shell({ id, data, children }: { id: string; data: any; children?: React.ReactNode }) {
  const { updateNodeData } = useReactFlow()
  const border = data.status === 'error' ? 'border-error' : data.status === 'done' ? 'border-success/50' : 'border-base-300'
  const cfg = data.config && Object.keys(data.config).length > 0 ? Object.entries(data.config) : null
  const onCfg = (k: string, v: string) => updateNodeData(id, { config: { ...data.config, [k]: v } })

  return (
    <div className={`card card-compact bg-base-100 border ${border} shadow-sm min-w-44 max-w-64 text-xs`}>
      <Handle type="target" position={Position.Top} />
      <div className="card-body p-0">
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-base-200">
          <span className="font-semibold flex-1">{data.label}</span>
          {data.status === 'running' && <span className="loading loading-spinner loading-xs" />}
        </div>
        {data.result && <div className={`px-2 py-1 text-[11px] ${data.status === 'error' ? 'text-error' : 'text-base-content/70'}`}>{data.result}</div>}
        {children}
        {cfg && <details className="border-t border-base-200/50">
          <summary className="px-2 py-1 text-[10px] text-base-content/30 cursor-pointer">config</summary>
          <div className="px-2 pb-1 space-y-1">{cfg.map(([k, v]) => (
            <label key={k} className="form-control">
              <span className="label-text text-[9px]">{k}</span>
              {String(v).includes('\n') || String(v).length > 50
                ? <textarea value={String(v)} rows={2} onChange={e => onCfg(k, e.target.value)} className="textarea textarea-bordered textarea-sm font-mono w-full" />
                : <input type={k === 'apiKey' ? 'password' : 'text'} value={String(v)} placeholder={k === 'apiKey' ? 'sk-...' : ''}
                    onChange={e => onCfg(k, e.target.value)} className="input input-bordered input-sm w-full" />}
            </label>
          ))}</div>
        </details>}
      </div>
      <Handle type="source" position={Position.Bottom} id="next" />
      <Handle type="source" position={Position.Right} id="data" style={{ background: '#d1d5db' }} />
      <Handle type="source" position={Position.Left} id="data-left" style={{ background: '#d1d5db' }} />
    </div>
  )
}

function UploadNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  return (
    <Shell id={id} data={data}>
      <div className="px-2 py-1">
        <label className="btn btn-sm btn-outline w-full">+ pliki
          <input type="file" accept=".pdf,.csv,.tsv,.txt,.json" multiple hidden onChange={e => {
            const f = Array.from(e.target.files || [])
            if (f.length) updateNodeData(id, { _files: f, _fileNames: f.map(x => x.name).join(', ') })
          }} />
        </label>
        {data._fileNames && <div className="text-[10px] text-base-content/50 mt-1">{data._fileNames as string}</div>}
      </div>
    </Shell>
  )
}

function DataNode({ data }: NodeProps) {
  return (
    <div className="badge badge-ghost gap-1 max-w-48">
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <span className="font-medium truncate">{data.label as string}</span>
      {data.detail && <span className="text-base-content/40 truncate text-[9px]">{data.detail as string}</span>}
    </div>
  )
}

export const nodeTypes = {
  upload: UploadNode,
  parse: ({ id, data }: NodeProps) => <Shell id={id} data={data} />,
  embed: ({ id, data }: NodeProps) => <Shell id={id} data={data} />,
  extract: ({ id, data }: NodeProps) => <Shell id={id} data={data} />,
  'extract-api': ({ id, data }: NodeProps) => <Shell id={id} data={data} />,
  graph: ({ id, data }: NodeProps) => <Shell id={id} data={data} />,
  data: DataNode,
}
