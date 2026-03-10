import type { Block } from './types'
import { BLOCK_DEFS } from './index'

export function BlockCard({ block, index, total, running, onRemove, onMove, onConfig, onRun }: {
  block: Block
  index: number
  total: number
  running?: boolean
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onConfig: (key: string, value: string) => void
  onRun?: () => void
}) {
  const def = BLOCK_DEFS.find(d => d.type === block.type)
  if (!def) return null

  return (
    <div className="card card-bordered card-compact mb-2 bg-base-100 shadow-sm"
      style={{ borderColor: `${def.color}55` }}>
      <div className="card-body p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="font-bold text-sm" style={{ color: def.color }}>{index + 1}. {def.label}</span>
          <span className="flex-1" />
          {onRun && <button className="btn btn-xs btn-ghost" style={{ color: def.color }} onClick={onRun} disabled={running}>▶</button>}
          {index > 0 && <button className="btn btn-xs btn-ghost" onClick={() => onMove(-1)}>↑</button>}
          {index < total - 1 && <button className="btn btn-xs btn-ghost" onClick={() => onMove(1)}>↓</button>}
          <button className="btn btn-xs btn-ghost text-error" onClick={onRemove}>✕</button>
        </div>

        {block.type === 'upload' && (
          <label className="btn btn-xs btn-primary mb-1" style={{ background: def.color, borderColor: def.color }}>
            Wybierz pliki
            <input type="file" accept=".pdf,.csv,.tsv,.txt,.json" multiple hidden onChange={e => {
              const files = Array.from(e.target.files || [])
              if (files.length) {
                (window as any).__miniCtxFiles = files
                onConfig('_files', files.map(f => f.name).join(', '))
              }
            }} />
          </label>
        )}
        {block.type === 'upload' && block.config._files && (
          <span className="text-xs text-base-content/50 ml-2">{block.config._files}</span>
        )}

        {def.fields.map(f => (
          <div key={f.key} className="form-control mb-1">
            <label className="label py-0"><span className="label-text text-xs">{f.label}</span></label>
            {(block.config[f.key]?.length ?? 0) > 60 ? (
              <textarea value={block.config[f.key] ?? ''} onChange={e => onConfig(f.key, e.target.value)}
                rows={3} className="textarea textarea-bordered textarea-xs font-mono w-full" />
            ) : (
              <input value={block.config[f.key] ?? ''} onChange={e => onConfig(f.key, e.target.value)}
                className="input input-bordered input-xs w-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
