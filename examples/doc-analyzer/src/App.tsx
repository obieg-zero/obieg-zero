import { useRef, useState } from 'react'
import { useStore } from './store.ts'
import { FileText, Play, X, Sliders, Terminal, Trash2, Check, AlertCircle, Upload, Moon, Sun, List, HardDrive, Database, Search, Clipboard } from 'react-feather'

const LVL = { i: 'text-info', ok: 'text-success', err: 'text-error', dim: 'text-base-content/30' }
const DOT = { processing: 'bg-warning', ready: 'bg-success', error: 'bg-error' }

export default function App() {
  const st = useStore()
  const { s, up, task } = st
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const queryRef = useRef<HTMLInputElement>(null)

  const ready = task?.docs.filter(d => d.status === 'ready') ?? []
  const rp = s.panel
  const [leftOpen, setLeftOpen] = useState(false)

  return (
    <div className="h-screen bg-base-200 overflow-hidden text-sm">
      <div className={`flex flex-row h-full transition-transform duration-300 ease-in-out ${leftOpen ? '' : 'max-md:-translate-x-72'}`}>

      {/* LEFT — Tasks */}
      <div className="w-72 shrink-0 flex flex-col bg-base-100 border-r border-base-300 min-h-0">
        <div className="flex items-center justify-between px-3 h-10 shrink-0 border-b border-base-300">
          <span className="text-xs font-semibold text-base-content/40 flex items-center gap-1.5"><List size={12} />Tasks</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* New task */}
          <div className="space-y-1">
            <div className="text-2xs uppercase tracking-wider text-base-content/25 font-medium">New task</div>
            {st.presets.length === 0 && !st.presetsLimited && <div className="text-2xs text-base-content/25">Loading…</div>}
            {st.presetsLimited && <div className="text-2xs text-warning/70">GitHub rate limited. Try in ~1h.</div>}
            {st.presets.map((p, i) => (
              <button key={i} onClick={() => st.create(p)} disabled={s.running}
                className="btn btn-ghost btn-xs w-full justify-start text-left h-auto py-1">
                <div className="leading-tight">
                  <div className="text-xs font-semibold">{p.name}</div>
                  <div className="text-2xs text-base-content/30">{p.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Task list */}
          {s.tasks.length > 0 && (
            <div className="space-y-1 pt-3 border-t border-base-300">
              <div className="text-2xs uppercase tracking-wider text-base-content/25 font-medium">Active ({s.tasks.length})</div>
              {s.tasks.map(t => (
                <div key={t.id} onClick={() => { st.activate(t.id); setLeftOpen(false) }}
                  className={`w-full text-left rounded p-2 cursor-pointer ${t.id === s.activeId ? 'bg-primary/10 border border-primary/30' : 'bg-base-200 hover:bg-base-300'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold truncate">{t.name}</span>
                    <button onClick={e => { e.stopPropagation(); st.remove(t.id) }}
                      className="btn btn-ghost btn-xs btn-square opacity-20 hover:opacity-100"><X size={10} /></button>
                  </div>
                  <div className="text-2xs text-base-content/25">
                    {t.docs.length} doc{t.docs.length !== 1 ? 's' : ''} · {t.docs.filter(d => d.status === 'ready').length} ready
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-base-300 px-3 py-2 text-2xs text-base-content/20 space-y-0.5">
          <div><a href="https://github.com/obieg-zero" target="_blank" rel="noopener" className="link link-hover text-base-content/40">obieg-zero</a> — zero backend, zero API, zero cloud</div>
          <div className="text-base-content/80">Your data never leaves your machine.</div>
        </div>
      </div>

      {/* CENTER */}
      <div className="flex-1 max-md:min-w-[100vw] flex flex-col bg-base-100 min-h-0">
        <div className="flex items-center justify-between px-3 h-10 shrink-0 border-b border-base-300">
          <span className="text-xs font-black text-primary flex items-center">
            <button onClick={() => setLeftOpen(!leftOpen)} className="flex items-center justify-center w-10 h-10 -ml-3 border-r border-base-300 hover:bg-base-200 md:hidden">{leftOpen ? <X size={18} /> : <List size={18} />}</button>
            <span className="ml-3">OBIEG-ZERO</span>
          </span>
          <div className="flex items-center gap-1">
            {task && <button onClick={() => up({ panel: rp === 'data' ? null : 'data' })} className={`btn btn-ghost btn-xs btn-square ${rp === 'data' ? 'btn-active' : ''}`}><HardDrive size={13} /></button>}
            <button onClick={() => up({ panel: rp === 'modules' ? null : 'modules' })} className={`btn btn-ghost btn-xs btn-square ${rp === 'modules' ? 'btn-active' : ''}`}><Sliders size={13} /></button>
            <button onClick={() => up({ panel: rp === 'log' ? null : 'log' })} className={`btn btn-ghost btn-xs btn-square ${rp === 'log' ? 'btn-active' : ''}`}><Terminal size={13} /></button>
            <button onClick={() => { const d = !s.dark; document.documentElement.dataset.theme = d ? 'dracula' : 'corporate'; up({ dark: d }) }}
              className="btn btn-ghost btn-xs btn-square">{s.dark ? <Sun size={13} /> : <Moon size={13} />}</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {!task ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto gap-6 text-center">
              <div className="text-3xl font-black text-primary tracking-tight">OBIEG-ZERO</div>
              <div className="text-sm text-base-content/50">Upload PDFs. Search semantically. Run local LLM. All in your browser.</div>
              <div className="text-2xs text-base-content/20">Pick a task from the sidebar.</div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">

              {/* Documents */}
              <div className="bg-base-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Upload size={14} />
                  <span className="font-semibold text-xs">Documents</span>
                  <span className="text-2xs text-base-content/30">{task.docs.length} uploaded, {ready.length} ready</span>
                </div>

                {/* Document slots (if task defines expected documents) */}
                {task.documents && task.documents.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {task.documents.map(slot => {
                      const assigned = task.docs.filter(d => d.docType === slot.type)
                      const filled = assigned.length > 0
                      return (
                        <div key={slot.type} className={`flex items-center gap-2 rounded px-3 py-1.5 ${filled ? 'bg-base-300' : 'bg-base-300/50 border border-dashed border-base-content/10'}`}>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${filled ? 'bg-success' : slot.required ? 'bg-error/50' : 'bg-base-content/15'}`} />
                          <span className="text-xs flex-1">{slot.label}{slot.required ? ' *' : ''}{slot.multiple ? ' (x)' : ''}</span>
                          {filled
                            ? <span className="text-2xs text-base-content/30">{assigned.map(d => d.name).join(', ')}</span>
                            : <span className="text-2xs text-base-content/20">awaiting</span>
                          }
                        </div>
                      )
                    })}
                  </div>
                )}

                <input type="file" accept=".pdf" multiple onChange={e => {
                  if (e.target.files) for (const f of e.target.files) st.addFile(f)
                }} disabled={s.running} className="file-input file-input-bordered file-input-xs w-full mb-2" />

                <div className="flex gap-2">
                  <textarea ref={pasteRef} placeholder="...or paste text" rows={2} disabled={s.running}
                    className="textarea textarea-bordered textarea-xs flex-1 font-mono" />
                  <button onClick={() => { st.addText(pasteRef.current?.value ?? ''); if (pasteRef.current) pasteRef.current.value = '' }}
                    disabled={s.running} className="btn btn-outline btn-xs self-end">Load</button>
                </div>

                {task.docs.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {task.docs.map(doc => {
                      const slotLabel = task.documents?.find(d => d.type === doc.docType)?.label
                      return (
                        <div key={doc.id}>
                          <div className="flex items-center gap-2 bg-base-300 rounded px-3 py-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[doc.status]}`} />
                            <FileText size={12} className="shrink-0 text-base-content/40" />
                            <span className="text-xs truncate flex-1">{doc.name}</span>
                            {doc.docType && <span className="badge badge-xs badge-outline">{slotLabel ?? doc.docType}</span>}
                            {doc.status === 'processing' && <span className="loading loading-spinner loading-xs" />}
                            {doc.status === 'ready' && <span className="text-2xs text-base-content/30">{doc.pages}p · {doc.chunks}ch</span>}
                            {doc.status === 'ready' && <Check size={12} className="text-success shrink-0" />}
                            {doc.status === 'error' && <span title={doc.error}><AlertCircle size={12} className="text-error shrink-0" /></span>}
                            <button onClick={() => st.removeDoc(doc.id)} className="btn btn-ghost btn-xs btn-square opacity-20 hover:opacity-100"><X size={10} /></button>
                          </div>
                          {s.progress[doc.scope] && <div className="text-2xs text-base-content/30 font-mono px-3 mt-0.5">{s.progress[doc.scope]}</div>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Extract — structured extraction from template */}
              {task.extract && task.extract.length > 0 && ready.length > 0 && (
                <div className="bg-base-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clipboard size={14} />
                      <span className="font-semibold text-xs">Extract</span>
                      <span className="text-2xs text-base-content/30">{task.extract.length} fields</span>
                    </div>
                    <button onClick={() => st.runExtract()} disabled={s.running}
                      className="btn btn-primary btn-sm gap-1">
                      {s.running ? <span className="loading loading-spinner loading-xs" /> : <Play size={12} />}
                      Extract
                    </button>
                  </div>

                  {s.running && s.streaming && (
                    <pre className="text-xs text-base-content/60 whitespace-pre-wrap bg-base-300 rounded p-3 max-h-40 overflow-y-auto mb-3">
                      {s.streaming}<span className="animate-pulse">|</span>
                    </pre>
                  )}

                  <div className="space-y-1">
                    {task.extract.map(field => {
                      const val = task.extracted?.[field.key]
                      return (
                        <div key={field.key} className="flex items-center justify-between bg-base-300 rounded px-3 py-1.5">
                          <span className="text-xs text-base-content/60">{field.label}</span>
                          <span className={`text-xs font-mono ${val ? 'text-base-content' : 'text-base-content/20'}`}>
                            {val ?? '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Query — free-form question */}
              {ready.length > 0 && (
                <div className="bg-base-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Search size={14} />
                    <span className="font-semibold text-xs">Query</span>
                    <span className="text-2xs text-base-content/30">across {ready.length} doc{ready.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex gap-2">
                    <input ref={queryRef} type="text" defaultValue={s.query}
                      onKeyDown={e => e.key === 'Enter' && st.ask(queryRef.current?.value ?? '')}
                      placeholder="e.g. What is the bank margin?" disabled={s.running}
                      className="input input-bordered input-sm flex-1" />
                    <button onClick={() => st.ask(queryRef.current?.value ?? '')} disabled={s.running}
                      className="btn btn-primary btn-sm gap-1">
                      {s.running ? <span className="loading loading-spinner loading-xs" /> : <Play size={12} />}
                      Ask
                    </button>
                  </div>
                  {s.running && s.streaming && (
                    <pre className="mt-3 text-xs text-base-content/60 whitespace-pre-wrap bg-base-300 rounded p-3 max-h-60 overflow-y-auto">
                      {s.streaming}<span className="animate-pulse">|</span>
                    </pre>
                  )}
                  {!s.running && s.answer && (
                    <div className="mt-3 bg-base-300 rounded p-3 text-xs whitespace-pre-wrap max-h-60 overflow-y-auto text-base-content/70">
                      {s.answer}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT */}
      {rp && (
        <div className="w-72 shrink-0 flex flex-col bg-base-100 border-l border-base-300 min-h-0">
          <div className="flex items-center justify-between px-3 h-10 shrink-0 border-b border-base-300">
            <span className="text-xs font-semibold text-base-content/40">
              {rp === 'data' && 'Data'}{rp === 'modules' && 'Modules'}{rp === 'log' && 'Log'}
            </span>
            <div className="flex items-center gap-1">
              {rp === 'log' && <button onClick={() => up({ logs: [] })} className="btn btn-ghost btn-xs btn-square text-base-content/30"><Trash2 size={12} /></button>}
              <button onClick={() => up({ panel: null })} className="btn btn-ghost btn-xs btn-square text-base-content/30"><X size={12} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">

            {rp === 'data' && task && (
              <div className="space-y-3">
                {st.opfs.length > 0 && st.opfs.map(f => (
                  <div key={f.name} className="text-2xs text-base-content/30 font-mono flex justify-between">
                    <span className="truncate">{f.name}</span>
                    <span className="text-base-content/20 shrink-0 ml-1">{f.size < 1024 ? `${f.size}B` : `${(f.size / 1024).toFixed(0)}KB`}</span>
                  </div>
                ))}
                {st.getVars().length > 0 && (
                  <div className="pt-3 border-t border-base-300">
                    <div className="text-2xs uppercase tracking-wider text-base-content/25 font-medium mb-2">Flow vars</div>
                    {st.getVars().map(([k, v]) => (
                      <div key={k} className="text-2xs text-base-content/30 truncate font-mono">
                        <span className="text-base-content/50">${k}</span> = {Array.isArray(v) ? `[${v.length}]` : String(v).slice(0, 30)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {rp === 'modules' && (
              <div className="space-y-3">
                {st.getModules().map(mod => (
                  <div key={mod.def.id} className="bg-base-200 rounded p-2">
                    <div className="text-xs font-semibold text-base-content/50 mb-2">{mod.def.label}</div>
                    {Object.entries(mod.def.settings).map(([key, def]) => (
                      <label key={key} className="flex items-center justify-between text-xs mb-1">
                        <span className="text-base-content/40 truncate mr-2">{def.label}</span>
                        <input type={def.type === 'number' ? 'number' : 'text'}
                          value={def.type === 'number' ? Number(mod.config[key] ?? def.default) : String(mod.config[key] ?? def.default)}
                          onChange={e => st.configure(mod.def.id, key, def.type === 'number' ? +e.target.value : e.target.value)}
                          className={`input input-bordered input-xs text-right font-mono ${def.type === 'string' ? 'w-32 text-2xs' : 'w-20'}`} />
                      </label>
                    ))}
                  </div>
                ))}
                <div className="bg-base-200 rounded p-2">
                  <div className="text-xs font-semibold text-base-content/50 mb-2 flex items-center gap-1.5">
                    <Database size={11} /> Models
                    {st.modelsSize > 0 && <span className="text-2xs text-base-content/30 font-normal ml-auto">{(st.modelsSize / 1024 / 1024).toFixed(0)}MB</span>}
                  </div>
                  {st.models.length === 0 && <div className="text-2xs text-base-content/25">No models yet</div>}
                  {st.models.map(m => (
                    <div key={m.url} className="flex items-center justify-between text-2xs mb-1">
                      <span className="text-base-content/40 truncate mr-2 font-mono">{m.url.split('/').pop()}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-base-content/25">{(m.size / 1024 / 1024).toFixed(0)}MB</span>
                        <button onClick={() => st.deleteModel(m.url)} className="btn btn-ghost btn-xs btn-square text-base-content/20 hover:text-error"><Trash2 size={10} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rp === 'log' && (
              <div className="font-mono text-2xs space-y-0.5">
                {s.logs.length === 0 && <div className="text-base-content/20">—</div>}
                {s.logs.map((l, i) => (
                  <div key={i} className={LVL[l.lvl]}><span className="text-base-content/15">{l.t}</span> {l.text}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
