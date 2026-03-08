import { useRef, type ReactNode, type ComponentType } from 'react'
import { useWorkbench } from './useWorkbench.ts'
import { STEP_DEFS, PRESETS, type StepType } from './types.ts'
import { FileText, Grid, Search, Cpu, Edit3, Play, X, Sliders, Layers, Terminal, Trash2, Check, AlertCircle, Upload, Moon, Sun, List } from 'react-feather'

const STEP_ICONS: Record<StepType, ComponentType<{ size?: number }>> = {
  ocr: FileText, embed: Grid, search: Search, llm: Cpu, template: Edit3,
}
const LOG_COLORS: Record<string, string> = { info: 'text-info', ok: 'text-success', err: 'text-error', dim: 'text-base-content/30' }
const STATUS_COLORS: Record<string, string> = { idle: 'bg-base-content/20', running: 'bg-warning', done: 'bg-success', error: 'bg-error' }

function Panel({ label, icon, onClose, onClear, actions, children, width = 'w-72' }: {
  label: string; icon?: ReactNode; onClose?: () => void; onClear?: () => void; actions?: ReactNode
  children: ReactNode; width?: string
}) {
  return (
    <div className={`${width} bg-base-100 border-r border-base-300 flex flex-col min-h-0`}>
      <div className="flex items-center justify-between px-3 h-10 shrink-0 border-b border-base-300">
        <span className="text-xs font-semibold text-base-content/40 flex items-center gap-1.5">{icon}{label}</span>
        <div className="flex items-center gap-1">
          {actions}
          {onClear && <button onClick={onClear} className="btn btn-ghost btn-xs btn-square text-base-content/30"><Trash2 size={12} /></button>}
          {onClose && <button onClick={onClose} className="btn btn-ghost btn-xs btn-square text-base-content/30"><X size={12} /></button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-2 pt-3 border-t border-base-300 first:border-t-0 first:pt-0 -mx-3 px-3">
      <div className="text-2xs uppercase tracking-wider text-base-content/25 font-medium">{label}</div>
      {children}
    </section>
  )
}

export default function App() {
  const wb = useWorkbench()
  const { s, up, busy, task } = wb
  const pasteRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div className="h-screen bg-base-200 flex overflow-hidden text-sm">
      {/* LEFT — Presets + Data */}
      <Panel label="Toolbox" icon={<Upload size={12} />} width="w-72">
        <div className="space-y-4">
          <Section label="New task">
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => wb.createTask(p)} disabled={busy}
                className="btn btn-ghost btn-xs w-full justify-start text-left h-auto py-1">
                <div className="leading-tight">
                  <div className="text-xs font-semibold">{p.name}</div>
                  <div className="text-2xs text-base-content/30">{p.desc}</div>
                </div>
              </button>
            ))}
          </Section>


        </div>
      </Panel>

      {/* CENTER — Active task */}
      <Panel
        label="workbench" icon={<span className="font-black text-primary">OBIEG-ZERO</span>} width="flex-1"
        actions={<>
          {task?.fileName && (
            <div className="flex items-center gap-2 text-xs text-base-content/50 mr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />{task.fileName}
            </div>
          )}
          {task && task.steps.length > 0 && (
            <button onClick={wb.runAll} disabled={busy || !task.file} className="btn btn-primary btn-xs gap-1 mr-1">
              {busy ? <span className="loading loading-spinner loading-xs" /> : <Play size={12} />}
              {busy ? 'Running…' : `Run all (${task.steps.length})`}
            </button>
          )}
          <button onClick={() => up({ modulesOpen: !s.modulesOpen })} className={`btn btn-ghost btn-xs btn-square ${s.modulesOpen ? 'btn-active' : ''}`}><Sliders size={13} /></button>
          <button onClick={() => up({ logOpen: !s.logOpen })} className={`btn btn-ghost btn-xs btn-square ${s.logOpen ? 'btn-active' : ''}`}><Terminal size={13} /></button>
          <button onClick={() => { const dark = !s.dark; document.documentElement.dataset.theme = dark ? 'dracula' : 'corporate'; up({ dark }) }}
            className="btn btn-ghost btn-xs btn-square">{s.dark ? <Sun size={13} /> : <Moon size={13} />}</button>
        </>}>
        {!task ? (
          <div className="flex flex-col items-center justify-center h-full text-base-content/20 gap-3">
            <div className="text-4xl font-light">pipeline</div>
            <p className="text-xs">Pick a task schema from the sidebar</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-0">
            {!task.file && (
              <div className="bg-base-200 rounded-lg p-4 mb-4 space-y-2">
                <input type="file" accept=".pdf" onChange={e => e.target.files?.[0] && wb.loadFile(e.target.files[0])} disabled={busy}
                  className="file-input file-input-bordered file-input-xs w-full" />
                <textarea ref={pasteRef} placeholder="...or paste text" rows={3} disabled={busy}
                  className="textarea textarea-bordered textarea-xs w-full font-mono" />
                <button onClick={() => wb.loadText(pasteRef.current?.value ?? '')} disabled={busy}
                  className="btn btn-outline btn-xs w-full">Load text</button>
              </div>
            )}
            {task.steps.map((step, idx) => {
              const st = STEP_DEFS[step.type]
              const Icon = STEP_ICONS[step.type]
              return (
                <div key={step.id}>
                  <div className={`bg-base-200 rounded-lg p-4 border-l-4 border-${st.color}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon size={14} />
                        <span className={`badge badge-xs badge-${st.color}`}>{idx + 1}</span>
                        <span className="font-semibold text-xs">{st.label}</span>
                        <span className="text-2xs text-base-content/30">{st.desc}</span>
                        {step.status === 'running' && <span className="loading loading-spinner loading-xs" />}
                        {step.status === 'done' && <Check size={12} className="text-success" />}
                        {step.status === 'error' && <AlertCircle size={12} className="text-error" />}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => wb.runStep(step)} disabled={busy || (st.needsInput && !step.input.trim()) || (!task.file && step.type !== 'template')}
                          className={`btn btn-${st.color} btn-xs btn-square`}><Play size={12} /></button>
                      </div>
                    </div>

                    {st.needsInput && (
                      step.type === 'template' ? (
                        <textarea value={step.input} onChange={e => wb.updateTaskStep(task.id, step.id, { input: e.target.value })}
                          placeholder={st.ph} disabled={busy}
                          className="textarea textarea-bordered textarea-sm w-full font-mono text-xs" rows={3} />
                      ) : (
                        <input type="text" value={step.input} onChange={e => wb.updateTaskStep(task.id, step.id, { input: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && task.file && wb.runStep(step)}
                          placeholder={st.ph} disabled={busy}
                          className="input input-bordered input-sm w-full" />
                      )
                    )}

                    {step.status === 'running' && step.type === 'llm' && s.streaming && (
                      <pre className="mt-2 text-xs text-base-content/60 whitespace-pre-wrap bg-base-300 rounded p-3 max-h-40 overflow-y-auto">
                        {s.streaming}<span className="animate-pulse">|</span>
                      </pre>
                    )}

                    {step.output && step.status !== 'running' && (
                      <div className={`mt-2 rounded p-3 text-xs whitespace-pre-wrap max-h-52 overflow-y-auto
                        ${step.type === 'template' ? 'font-mono' : ''}
                        ${step.status === 'error' ? 'bg-error/10 text-error' : 'bg-base-300 text-base-content/70'}`}>
                        {step.output}
                      </div>
                    )}

                    {step.meta && step.status === 'done' && (
                      <div className="mt-1 text-2xs text-base-content/25 font-mono">{step.meta}</div>
                    )}
                  </div>
                  {idx < task.steps.length - 1 && <div className="flex justify-center py-1"><span className="text-base-content/10 text-lg">|</span></div>}
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* RIGHT — Task list */}
      <Panel label={`Tasks (${s.tasks.length})`} icon={<List size={12} />} width="w-72">
        <div className="space-y-2">
          {s.tasks.map(t => (
            <button key={t.id} onClick={() => wb.activateTask(t.id)}
              className={`w-full text-left rounded p-2 ${t.id === s.activeTaskId ? 'bg-primary/10 border border-primary/30' : 'bg-base-200 hover:bg-base-300'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[t.status]}`} />
                  <span className="text-xs font-semibold truncate">{t.name}</span>
                </div>
                <button onClick={e => { e.stopPropagation(); wb.removeTask(t.id) }}
                  className="btn btn-ghost btn-xs btn-square opacity-20 hover:opacity-100"><X size={10} /></button>
              </div>
              {t.fileName && (
                <div className="text-2xs text-base-content/40 truncate ml-4">{t.fileName}</div>
              )}
              <div className="text-2xs text-base-content/25 ml-4">
                {t.steps.filter(s => s.status === 'done').length}/{t.steps.length} steps
              </div>
            </button>
          ))}
          {task && wb.getVars().length > 0 && (
            <div className="border-t border-base-300 -mx-3 px-3 pt-3 mt-3">
              <div className="text-2xs uppercase tracking-wider text-base-content/25 font-medium mb-2">Flow vars</div>
              {wb.getVars().map(([k, v]) => {
                const display = Array.isArray(v) ? `[${v.length}]` : typeof v === 'object' ? JSON.stringify(v).slice(0, 30) : String(v).slice(0, 30)
                return (
                  <div key={k} className="text-2xs text-base-content/30 truncate font-mono" title={typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : String(v)}>
                    <span className="text-base-content/50">${k}</span> = {display}
                  </div>
                )
              })}
            </div>
          )}
          {s.tasks.length === 0 && (
            <div className="text-center text-base-content/20 py-8 text-xs">Pick a schema from Toolbox</div>
          )}
        </div>
      </Panel>

      {/* OPTIONAL PANELS */}
      {s.modulesOpen && (
        <Panel label="Modules" icon={<Sliders size={12} />} onClose={() => up({ modulesOpen: false })}>
          <div className="space-y-3">
            {wb.getModules().map(mod => (
              <div key={mod.def.id} className="bg-base-200 rounded p-2">
                <div className="text-xs font-semibold text-base-content/50 mb-2">{mod.def.label}</div>
                {Object.entries(mod.def.settings).map(([key, def]) => (
                  <label key={key} className="flex items-center justify-between text-xs mb-1">
                    <span className="text-base-content/40 truncate mr-2">{def.label}</span>
                    <input
                      type={def.type === 'number' ? 'number' : 'text'}
                      value={def.type === 'number' ? Number(mod.config[key] ?? def.default) : String(mod.config[key] ?? def.default)}
                      onChange={e => wb.configureMod(mod.def.id, key, def.type === 'number' ? +e.target.value : e.target.value)}
                      className={`input input-bordered input-xs text-right font-mono ${def.type === 'string' ? 'w-32 text-2xs' : 'w-20'}`} />
                  </label>
                ))}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {s.logOpen && (
        <Panel label="Log" icon={<Terminal size={12} />} onClose={() => up({ logOpen: false })} onClear={() => up({ logs: [] })}>
          <div className="font-mono text-2xs space-y-0.5">
            {s.logs.length === 0 && <div className="text-base-content/20">—</div>}
            {s.logs.map((l, i) => (
              <div key={i} className={LOG_COLORS[l.level]}><span className="text-base-content/15">{l.t}</span> {l.text}</div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
