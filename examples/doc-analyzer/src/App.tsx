import { useRef, useState, type ReactNode, type ComponentType } from 'react'
import { useWorkbench } from './useWorkbench.ts'
import { STEP_DEFS, type StepType } from './types.ts'
import { FileText, Grid, Search, Cpu, Edit3, Play, X, Sliders, Terminal, Trash2, Check, AlertCircle, Upload, Moon, Sun, List, Database, HardDrive } from 'react-feather'

const STEP_ICONS: Record<StepType, ComponentType<{ size?: number }>> = {
  ocr: FileText, embed: Grid, search: Search, llm: Cpu, template: Edit3,
}
const LOG_COLORS: Record<string, string> = { info: 'text-info', ok: 'text-success', err: 'text-error', dim: 'text-base-content/30' }
const STATUS_COLORS: Record<string, string> = { idle: 'bg-base-content/20', running: 'bg-warning', done: 'bg-success', error: 'bg-error' }

function Panel({ label, icon, onClose, onClear, actions, children, footer, width = 'w-72' }: {
  label: string; icon?: ReactNode; onClose?: () => void; onClear?: () => void; actions?: ReactNode
  children: ReactNode; footer?: ReactNode; width?: string
}) {
  return (
    <div className={`${width} bg-base-100 border-r border-base-300 flex-col min-h-0`}>
      <div className="flex items-center justify-between px-3 h-10 shrink-0 border-b border-base-300">
        <span className="text-xs font-semibold text-base-content/40 flex items-center gap-1.5">{icon}{label}</span>
        <div className="flex items-center gap-1">
          {actions}
          {onClear && <button onClick={onClear} className="btn btn-ghost btn-xs btn-square text-base-content/30"><Trash2 size={12} /></button>}
          {onClose && <button onClick={onClose} className="btn btn-ghost btn-xs btn-square text-base-content/30"><X size={12} /></button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
      {footer}
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
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')

  const openOpfsFile = async (name: string) => {
    if (previewFile === name) { setPreviewFile(null); return }
    if (!task) return
    try {
      const { readProjectFile } = await import('@obieg-zero/storage')
      setPreviewContent(await readProjectFile(task.projectId, name))
      setPreviewFile(name)
    } catch { setPreviewContent('Failed to read file') ; setPreviewFile(name) }
  }

  const mv = s.mobileView
  const setMv = (v: typeof mv) => up({ mobileView: v })

  return (
    <div className="h-screen bg-base-200 flex flex-col md:flex-row overflow-hidden text-sm">
      {/* LEFT — Tasks + Presets */}
      <Panel label="Tasks" icon={<List size={12} />} width={`${mv === 'tasks' ? 'flex' : 'hidden'} md:flex w-full md:w-72`} footer={
        <div className="shrink-0 border-t border-base-300 px-3 py-2 text-2xs text-base-content/20 space-y-0.5">
          <div><a href="https://github.com/obieg-zero" target="_blank" rel="noopener" className="link link-hover text-base-content/40">obieg-zero</a> — zero backend, zero API, zero cloud</div>
          <div className="text-base-content/80">Your data never leaves your machine.</div>
          <div><a href="https://www.npmjs.com/org/obieg-zero" target="_blank" rel="noopener" className="link link-hover text-base-content/40">npm</a> · <a href="https://github.com/obieg-zero/obieg-zero" target="_blank" rel="noopener" className="link link-hover text-base-content/40">source</a> · MIT</div>
        </div>
      }>
        <div className="space-y-4">
          <Section label="New task">
            {wb.presets.length === 0 && !wb.presetsRateLimited && <div className="text-2xs text-base-content/25">Loading tasks from GitHub…</div>}
            {wb.presetsRateLimited && <div className="text-2xs text-warning/70">GitHub API rate limit exceeded. This is a free, budget-zero app — no API keys, no backend. Try again in ~1 hour.</div>}
            {wb.presets.map((p, i) => (
              <button key={i} onClick={() => { wb.createTask(p); setMv('pipeline') }} disabled={busy}
                className="btn btn-ghost btn-xs w-full justify-start text-left h-auto py-1">
                <div className="leading-tight">
                  <div className="text-xs font-semibold">{p.name}</div>
                  <div className="text-2xs text-base-content/30">{p.desc}</div>
                </div>
              </button>
            ))}
          </Section>

          {s.tasks.length > 0 && (
            <Section label={`Active (${s.tasks.length})`}>
              {s.tasks.map(t => (
                <div key={t.id} onClick={() => { wb.activateTask(t.id); setMv('pipeline') }}
                  className={`w-full text-left rounded p-2 cursor-pointer ${t.id === s.activeTaskId ? 'bg-primary/10 border border-primary/30' : 'bg-base-200 hover:bg-base-300'}`}>
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
                </div>
              ))}
            </Section>
          )}
        </div>
      </Panel>

      {/* CENTER — Active task */}
      <Panel
        label="workbench" icon={<span className="font-black text-primary">OBIEG-ZERO</span>}
        width={`${mv === 'pipeline' ? 'flex' : 'hidden'} md:flex flex-1`}
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
          {task && <button onClick={() => up({ rightPanel: s.rightPanel === 'data' ? null : 'data' })} className={`btn btn-ghost btn-xs btn-square ${s.rightPanel === 'data' ? 'btn-active' : ''}`}><HardDrive size={13} /></button>}
          <button onClick={() => up({ rightPanel: s.rightPanel === 'modules' ? null : 'modules' })} className={`btn btn-ghost btn-xs btn-square ${s.rightPanel === 'modules' ? 'btn-active' : ''}`}><Sliders size={13} /></button>
          <button onClick={() => up({ rightPanel: s.rightPanel === 'log' ? null : 'log' })} className={`btn btn-ghost btn-xs btn-square ${s.rightPanel === 'log' ? 'btn-active' : ''}`}><Terminal size={13} /></button>
          <button onClick={() => { const dark = !s.dark; document.documentElement.dataset.theme = dark ? 'dracula' : 'corporate'; up({ dark }) }}
            className="btn btn-ghost btn-xs btn-square">{s.dark ? <Sun size={13} /> : <Moon size={13} />}</button>
        </>}>
        {!task ? (
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto gap-6 text-center">
            <div>
              <div className="text-3xl font-black text-primary tracking-tight">OBIEG-ZERO</div>
              <div className="text-xs text-base-content/30 mt-1">Browser-native document analysis pipeline</div>
            </div>
            <div className="text-sm text-base-content/50 leading-relaxed space-y-3">
              <p>Upload a PDF. Extract text. Search semantically. Run local LLM inference. All in your browser — no server, no API keys, no data leaves your machine.</p>
              <div className="flex justify-center gap-6 text-2xs text-base-content/25">
                <span><FileText size={11} className="inline -mt-0.5" /> OCR</span>
                <span><Grid size={11} className="inline -mt-0.5" /> Embed</span>
                <span><Search size={11} className="inline -mt-0.5" /> Search</span>
                <span><Cpu size={11} className="inline -mt-0.5" /> LLM</span>
                <span><Edit3 size={11} className="inline -mt-0.5" /> Template</span>
              </div>
            </div>
            <div className="text-2xs text-base-content/20">Pick a task from the sidebar to start.</div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-0">
            <div className="bg-base-200 rounded-lg p-4 border-l-4 border-accent">
              <div className="flex items-center gap-2 mb-2">
                <Upload size={14} />
                <span className="badge badge-xs badge-accent">0</span>
                <span className="font-semibold text-xs">Document</span>
                <span className="text-2xs text-base-content/30">Input data for pipeline</span>
                {task.file && <Check size={12} className="text-success" />}
              </div>
              <div className="space-y-2">
                <input type="file" accept=".pdf" onChange={e => e.target.files?.[0] && wb.loadFile(e.target.files[0])} disabled={busy}
                  className="file-input file-input-bordered file-input-xs w-full" />
                <textarea ref={pasteRef} placeholder="...or paste text" rows={2} disabled={busy}
                  className="textarea textarea-bordered textarea-xs w-full font-mono" />
                <button onClick={() => wb.loadText(pasteRef.current?.value ?? '')} disabled={busy}
                  className="btn btn-outline btn-xs w-full">Load text</button>
              </div>
            </div>
            {task.steps.length > 0 && <div className="flex justify-center py-1"><span className="text-base-content/10 text-lg">|</span></div>}
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

      {/* RIGHT — switched panel */}
      {s.rightPanel === 'data' && task && (
        <Panel label={task.name} icon={<HardDrive size={12} />}
          width={`${mv === 'panel' ? 'flex' : 'hidden'} md:flex w-full md:w-72`}
          onClose={() => up({ rightPanel: null, mobileView: 'pipeline' })}>
          <div className="space-y-4">
            {wb.opfsFiles.length > 0 && (
              <Section label="OPFS files">
                {wb.opfsFiles.map(f => (
                  <div key={f.name}>
                    <div onClick={() => f.name.endsWith('.json') ? openOpfsFile(f.name) : null}
                      className={`text-2xs text-base-content/30 font-mono flex items-center justify-between ${f.name.endsWith('.json') ? 'cursor-pointer hover:text-base-content/60' : ''}`}>
                      <span className="truncate" title={f.name}>
                        {previewFile === f.name ? '- ' : f.name.endsWith('.json') ? '+ ' : '  '}{f.name}
                      </span>
                      <span className="text-base-content/20 shrink-0 ml-1">{f.size < 1024 ? `${f.size} B` : `${(f.size / 1024).toFixed(0)} KB`}</span>
                    </div>
                    {previewFile === f.name && (
                      <pre className="text-2xs text-base-content/50 bg-base-200 rounded p-2 mt-1 mb-2 max-h-60 overflow-auto whitespace-pre-wrap break-all font-mono">
                        {previewContent.slice(0, 5000)}{previewContent.length > 5000 ? '\n…truncated' : ''}
                      </pre>
                    )}
                  </div>
                ))}
              </Section>
            )}

            {wb.getVars().length > 0 && (
              <Section label="Flow vars">
                {wb.getVars().map(([k, v]) => {
                  const display = Array.isArray(v) ? `[${v.length}]` : typeof v === 'object' ? JSON.stringify(v).slice(0, 30) : String(v).slice(0, 30)
                  return (
                    <div key={k} className="text-2xs text-base-content/30 truncate font-mono" title={typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : String(v)}>
                      <span className="text-base-content/50">${k}</span> = {display}
                    </div>
                  )
                })}
              </Section>
            )}
          </div>
        </Panel>
      )}

      {s.rightPanel === 'modules' && (
        <Panel label="Modules" icon={<Sliders size={12} />}
          width={`${mv === 'panel' ? 'flex' : 'hidden'} md:flex w-full md:w-72`}
          onClose={() => up({ rightPanel: null, mobileView: 'pipeline' })}>
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
            <div className="bg-base-200 rounded p-2">
              <div className="text-xs font-semibold text-base-content/50 mb-2 flex items-center gap-1.5">
                <Database size={11} /> Models
                {wb.models.totalSize > 0 && (
                  <span className="text-2xs text-base-content/30 font-normal ml-auto">
                    {(wb.models.totalSize / 1024 / 1024).toFixed(0)} MB
                  </span>
                )}
              </div>
              {wb.models.list.length === 0 && (
                <div className="text-2xs text-base-content/25">No models downloaded yet</div>
              )}
              {wb.models.list.map(m => (
                <div key={m.url} className="flex items-center justify-between text-2xs mb-1">
                  <span className="text-base-content/40 truncate mr-2 font-mono" title={m.url}>
                    {m.url.split('/').pop()}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-base-content/25">{(m.size / 1024 / 1024).toFixed(0)} MB</span>
                    <button onClick={() => wb.deleteModel(m.url)}
                      className="btn btn-ghost btn-xs btn-square text-base-content/20 hover:text-error">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      )}

      {s.rightPanel === 'log' && (
        <Panel label="Log" icon={<Terminal size={12} />}
          width={`${mv === 'panel' ? 'flex' : 'hidden'} md:flex w-full md:w-72`}
          onClose={() => up({ rightPanel: null, mobileView: 'pipeline' })} onClear={() => up({ logs: [] })}>
          <div className="font-mono text-2xs space-y-0.5">
            {s.logs.length === 0 && <div className="text-base-content/20">—</div>}
            {s.logs.map((l, i) => (
              <div key={i} className={LOG_COLORS[l.level]}><span className="text-base-content/15">{l.t}</span> {l.text}</div>
            ))}
          </div>
        </Panel>
      )}

      {/* Mobile bottom nav */}
      <div className="md:hidden btm-nav btm-nav-xs bg-base-100 border-t border-base-300">
        <button onClick={() => setMv('tasks')} className={mv === 'tasks' ? 'active' : ''}><List size={16} /></button>
        <button onClick={() => setMv('pipeline')} className={mv === 'pipeline' ? 'active' : ''}><Play size={16} /></button>
        <button onClick={() => { setMv('panel'); if (!s.rightPanel) up({ rightPanel: 'log' }) }} className={mv === 'panel' ? 'active' : ''}><Sliders size={16} /></button>
      </div>
    </div>
  )
}
