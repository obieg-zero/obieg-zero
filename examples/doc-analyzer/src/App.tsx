import { useRef } from 'react'
import { useWorkbench } from './useWorkbench.ts'
import { STEP_DEFS, PRESETS, type StepType } from './types.ts'

const LOG_COLORS: Record<string, string> = { info: 'text-sky-400', ok: 'text-emerald-400', err: 'text-red-400', dim: 'text-gray-500' }
const FLOW_VARS = ['query', 'context', 'answer', 'prompt', 'extracted', 'extractError', 'pages', 'chunks', 'matchedChunks', 'llmReady']

export default function App() {
  const wb = useWorkbench()
  const { s, up, busy, hasFile } = wb
  const fileRef = useRef<HTMLInputElement>(null)
  const pasteRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div className="min-h-screen bg-base-200 flex flex-col text-sm">
      <header className="bg-base-100 border-b border-base-300 px-4 py-2 flex items-center justify-between">
        <h1 className="font-mono font-light">obieg<span className="text-primary">-zero</span> <span className="text-base-content/30 text-xs">workbench</span></h1>
        <div className="flex items-center gap-3">
          {hasFile && (
            <div className="flex items-center gap-2 text-xs text-base-content/50">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              {s.fileName}
            </div>
          )}
          <HeaderBtn active={s.modulesOpen} onClick={() => up({ modulesOpen: !s.modulesOpen })} label="modules" />
          <HeaderBtn active={s.chunksOpen} onClick={() => up({ chunksOpen: !s.chunksOpen })} label="chunks" />
          <HeaderBtn active={s.logOpen} onClick={() => up({ logOpen: !s.logOpen })} label={`log${s.logs.length ? ` (${s.logs.length})` : ''}`} />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-56 bg-base-100 border-r border-base-300 p-3 space-y-4 flex-shrink-0 overflow-y-auto">
          <Section label="Data">
            <input ref={fileRef} type="file" accept=".pdf" onChange={e => e.target.files?.[0] && wb.loadFile(e.target.files[0])} disabled={busy}
              className="file-input file-input-bordered file-input-xs w-full" />
            <textarea ref={pasteRef} placeholder="...or paste text" rows={3} disabled={busy}
              className="textarea textarea-bordered textarea-xs w-full font-mono text-[10px] leading-snug" />
            <button onClick={() => wb.loadText(pasteRef.current?.value ?? '')} disabled={busy}
              className="btn btn-outline btn-xs w-full">Load text</button>
          </Section>

          <Section label="Blocks">
            {(Object.keys(STEP_DEFS) as StepType[]).map(type => {
              const st = STEP_DEFS[type]
              return (
                <button key={type} onClick={() => wb.addStep(type)} disabled={busy}
                  className={`btn btn-${st.color} btn-outline btn-xs w-full justify-start gap-2 h-auto py-1`}>
                  <span className="text-sm opacity-60">{st.icon}</span>
                  <div className="text-left leading-tight">
                    <div className="font-bold text-[11px]">{st.label}</div>
                    <div className="text-[8px] opacity-50 font-normal">{st.desc}</div>
                  </div>
                </button>
              )
            })}
          </Section>

          <Section label="Presets">
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => wb.loadPreset(p)} disabled={busy}
                className="btn btn-ghost btn-xs w-full justify-start text-left h-auto py-1">
                <div className="leading-tight">
                  <div className="text-[11px] font-bold">{p.name}</div>
                  <div className="text-[8px] text-base-content/30">{p.desc}</div>
                </div>
              </button>
            ))}
          </Section>

          <Section label="Flow vars">
            {FLOW_VARS.map(k => {
              const v = wb.getVar(k)
              if (v == null) return null
              const display = Array.isArray(v) ? `[${v.length}]` : typeof v === 'object' ? JSON.stringify(v).slice(0, 30) : String(v).slice(0, 30)
              return (
                <div key={k} className="text-[9px] text-base-content/30 truncate" title={typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : String(v)}>
                  <span className="text-base-content/50 font-mono">${k}</span> = {display}
                </div>
              )
            })}
          </Section>
        </aside>

        {/* MAIN */}
        <main className="flex-1 p-4 overflow-y-auto">
          {s.steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-base-content/20 gap-3">
              <div className="text-4xl">pipeline</div>
              <p>Build a document analysis pipeline</p>
              <p className="text-xs max-w-sm text-center">
                <strong>OCR</strong> - <strong>Embed</strong> - <strong>Search</strong> - <strong>LLM</strong> - <strong>Template</strong>
              </p>
              <p className="text-xs text-base-content/30">or pick a preset from the sidebar</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-0">
              {s.steps.map((step, idx) => {
                const st = STEP_DEFS[step.type]
                return (
                  <div key={step.id}>
                    <div className={`bg-base-100 rounded-lg p-4 shadow-sm border-l-4 border-${st.color}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="opacity-40">{st.icon}</span>
                          <span className={`badge badge-xs badge-${st.color}`}>{idx + 1}</span>
                          <span className="font-bold text-xs">{st.label}</span>
                          <span className="text-[10px] text-base-content/30 font-normal">{st.desc}</span>
                          {step.status === 'running' && <span className="loading loading-spinner loading-xs" />}
                          {step.status === 'done' && <span className="text-success text-xs">done</span>}
                          {step.status === 'error' && <span className="text-error text-xs">error</span>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => wb.runStep(step)} disabled={busy || (st.needsInput && !step.input.trim()) || (!hasFile && step.type !== 'template')}
                            className={`btn btn-${st.color} btn-xs`}>run</button>
                          <button onClick={() => wb.removeStep(step.id)} disabled={busy}
                            className="btn btn-ghost btn-xs opacity-30 hover:opacity-100">x</button>
                        </div>
                      </div>

                      {st.needsInput && (
                        step.type === 'template' ? (
                          <textarea value={step.input} onChange={e => wb.updateStep(step.id, { input: e.target.value })}
                            placeholder={st.ph} disabled={busy}
                            className="textarea textarea-bordered textarea-sm w-full font-mono text-xs" rows={3} />
                        ) : (
                          <input type="text" value={step.input} onChange={e => wb.updateStep(step.id, { input: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && hasFile && wb.runStep(step)}
                            placeholder={st.ph} disabled={busy}
                            className="input input-bordered input-sm w-full" />
                        )
                      )}

                      {step.status === 'running' && step.type === 'llm' && s.streaming && (
                        <pre className="mt-2 text-xs text-base-content/60 whitespace-pre-wrap font-sans bg-base-200 rounded p-3 max-h-40 overflow-y-auto">
                          {s.streaming}<span className="animate-pulse">|</span>
                        </pre>
                      )}

                      {step.output && step.status !== 'running' && (
                        <div className={`mt-2 rounded p-3 text-xs whitespace-pre-wrap max-h-52 overflow-y-auto
                          ${step.type === 'template' ? 'font-mono' : 'font-sans'}
                          ${step.status === 'error' ? 'bg-error/10 text-error' : 'bg-base-200 text-base-content/70'}`}>
                          {step.output}
                        </div>
                      )}

                      {step.meta && step.status === 'done' && (
                        <div className="mt-1 text-[10px] text-base-content/30">{step.meta}</div>
                      )}
                    </div>
                    {idx < s.steps.length - 1 && <div className="flex justify-center py-1"><span className="text-base-content/15 text-xl">|</span></div>}
                  </div>
                )
              })}

              <div className="pt-4 flex items-center gap-3">
                <button onClick={wb.runAll} disabled={busy || !hasFile} className="btn btn-primary btn-sm flex-1">
                  {busy ? <><span className="loading loading-spinner loading-xs" /> Running...</> : `Run pipeline (${s.steps.length})`}
                </button>
                {!hasFile && <span className="text-xs text-warning">load a PDF file first</span>}
              </div>
            </div>
          )}
        </main>

        {/* MODULES PANEL — settings from framework, one source of truth */}
        {s.modulesOpen && (
          <aside className="w-72 bg-base-100 border-l border-base-300 flex flex-col flex-shrink-0">
            <PanelHeader label="Modules" onClose={() => up({ modulesOpen: false })} />
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {wb.getModules().map(mod => (
                <div key={mod.def.id} className="bg-base-200 rounded p-2">
                  <div className="text-[10px] font-bold text-base-content/60 mb-2">{mod.def.label}</div>
                  {Object.entries(mod.def.settings).map(([key, def]) => (
                    <label key={key} className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-base-content/50 truncate mr-2">{def.label}</span>
                      {def.type === 'string' ? (
                        <input type="text" value={String(mod.config[key] ?? def.default)}
                          onChange={e => wb.configureMod(mod.def.id, key, e.target.value)}
                          className="input input-bordered input-xs w-32 text-right font-mono text-[9px]" />
                      ) : (
                        <input type="number" value={Number(mod.config[key] ?? def.default)}
                          onChange={e => wb.configureMod(mod.def.id, key, +e.target.value)}
                          className="input input-bordered input-xs w-20 text-right font-mono" />
                      )}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* CHUNKS PANEL */}
        {s.chunksOpen && (
          <aside className="w-72 bg-base-100 border-l border-base-300 flex flex-col flex-shrink-0">
            <PanelHeader label={`Chunks (${wb.getChunks().length})`} onClose={() => up({ chunksOpen: false })} />
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {wb.getChunks().map((ch, i) => (
                <div key={i} className="bg-base-200 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-mono text-base-content/30">#{i + 1} str. {ch.page}</span>
                    <span className="text-[9px] font-mono text-base-content/20">{ch.text.length} zn</span>
                  </div>
                  <div className="text-[10px] text-base-content/60 leading-snug line-clamp-4">{ch.text}</div>
                </div>
              ))}
              {wb.getChunks().length === 0 && <div className="text-center text-base-content/20 py-8 text-xs">Run pipeline with OCR + Embed first</div>}
            </div>
          </aside>
        )}

        {/* LOG PANEL */}
        {s.logOpen && (
          <aside className="w-64 bg-gray-900 text-gray-300 border-l border-gray-700 flex flex-col flex-shrink-0">
            <PanelHeader label="Log" onClose={() => up({ logOpen: false })} dark onClear={() => up({ logs: [] })} />
            <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-0.5">
              {s.logs.length === 0 && <div className="text-gray-600">...</div>}
              {s.logs.map((l, i) => (
                <div key={i} className={LOG_COLORS[l.level]}><span className="text-gray-600">{l.t}</span> {l.text}</div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="text-[10px] text-base-content/30 uppercase tracking-widest font-mono">{label}</div>
      {children}
    </section>
  )
}

function HeaderBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`btn btn-ghost btn-xs font-mono ${active ? 'btn-active' : ''}`}>{label}</button>
}

function PanelHeader({ label, onClose, onClear, dark }: { label: string; onClose: () => void; onClear?: () => void; dark?: boolean }) {
  const cls = dark ? 'border-gray-700' : 'border-base-300'
  const txt = dark ? 'text-gray-500' : 'text-base-content/30'
  return (
    <div className={`flex items-center justify-between px-3 py-1.5 border-b ${cls}`}>
      <span className={`text-[10px] font-mono uppercase tracking-widest ${txt}`}>{label}</span>
      <div className="flex gap-1">
        {onClear && <button onClick={onClear} className={`btn btn-ghost btn-xs ${txt}`}>clear</button>}
        <button onClick={onClose} className={`btn btn-ghost btn-xs ${txt}`}>x</button>
      </div>
    </div>
  )
}
