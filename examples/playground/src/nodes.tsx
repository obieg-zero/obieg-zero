import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'

// --- shared shell ---

function Shell({ id, data, children }: { id: string; data: any; children?: React.ReactNode }) {
  const { updateNodeData } = useReactFlow()
  const hasError = data.status === 'error'
  const borderClass = hasError ? 'border-error' : data.status === 'done' ? 'border-success/50' : 'border-base-300'

  return (
    <div className={`bg-base-100 border ${borderClass} rounded-lg shadow-sm min-w-44 max-w-64 text-xs`}>
      <Handle type="target" position={Position.Top} />

      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-base-200">
        <span className="font-semibold">{data.label}</span>
        <span className="flex-1" />
        {data.status === 'running' && <span className="loading loading-spinner loading-xs" />}
      </div>

      {/* result — the main thing user needs to see */}
      {data.result && (
        <div className={`px-2 py-1.5 text-[11px] ${hasError ? 'text-error font-semibold' : 'text-base-content/70'}`}>
          {data.result}
        </div>
      )}

      {children}

      {data.config && Object.keys(data.config).length > 0 && (
        <details className="px-2 py-1 border-t border-base-200/50">
          <summary className="text-[10px] text-base-content/30 cursor-pointer">config</summary>
          <div className="mt-1 space-y-0.5">
            {Object.entries(data.config).map(([k, v]) => (
              <div key={k}>
                <div className="text-[9px] text-base-content/40">{k}</div>
                {String(v).includes('\n') || String(v).length > 50 ? (
                  <textarea value={String(v)} rows={2}
                    onChange={e => updateNodeData(id, { config: { ...data.config, [k]: e.target.value } })}
                    className="textarea textarea-bordered textarea-xs font-mono w-full" />
                ) : k === 'apiKey' ? (
                  <input type="password" value={String(v)} placeholder="sk-..."
                    onChange={e => updateNodeData(id, { config: { ...data.config, [k]: e.target.value } })}
                    className="input input-bordered input-xs w-full" />
                ) : (
                  <input value={String(v)}
                    onChange={e => updateNodeData(id, { config: { ...data.config, [k]: e.target.value } })}
                    className="input input-bordered input-xs w-full" />
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      <Handle type="source" position={Position.Bottom} id="next" />
      <Handle type="source" position={Position.Right} id="data" style={{ background: '#d1d5db' }} />
      <Handle type="source" position={Position.Left} id="data-left" style={{ background: '#d1d5db' }} />
    </div>
  )
}

// --- block nodes ---

function UploadNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  return (
    <Shell id={id} data={data}>
      <div className="px-2 py-1">
        <label className="btn btn-xs btn-outline w-full">
          + pliki
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
    <div className="bg-base-200/80 border border-base-300/50 rounded px-2 py-1 text-[10px] max-w-48">
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <div className="font-medium">{data.label as string}</div>
      {data.detail && <div className="text-base-content/40 truncate">{data.detail as string}</div>}
    </div>
  )
}

function GenericNode({ id, data }: NodeProps) {
  return <Shell id={id} data={data} />
}

export const nodeTypes = {
  upload: UploadNode,
  parse: GenericNode,
  embed: GenericNode,
  extract: GenericNode,
  'extract-api': GenericNode,
  graph: GenericNode,
  data: DataNode,
}
