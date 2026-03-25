import type { StageViewProps, StageView, SchemaField, TaskDef, BranchDef, StageDef, PostRecord } from '../../views'
import { submitStageData } from '../../views'

// ── View: SelectField ────────────────────────────────────────────────

export function SelectField({ field, bind, store, ui }: {
  field: SchemaField
  bind: (key: string) => { value: unknown; onChange: (e: unknown) => void }
  store: StageViewProps['store']
  ui: StageViewProps['ui']
}) {
  const options = (store.usePosts(field.inputType!.split(':')[1]) as PostRecord[])
    .map((r: PostRecord) => ({ value: r.id, label: r.data.name || r.id }))
  return (
    <ui.Field label={field.label} required={field.required}>
      {options.length > 0
        ? <ui.Select {...bind(field.key)} options={[{ value: '', label: '— wybierz —' }, ...options]} />
        : <ui.Input {...bind(field.key)} placeholder="Wpisz ręcznie" />}
    </ui.Field>
  )
}

// ── View: FormView ───────────────────────────────────────────────────

export function FormView({ node, cas, wf, store, sdk, ui, advanceToStage, getNextStage }: StageViewProps) {
  const stepNum = node.data.label?.match(/^(\d+)/)?.[1]
  const title = (node.data.label || '').replace(/^\d+\.\s*/, '')
  const stage = wf.stages.find((s: StageDef) => s.id === node.id)!
  const recordType = stage.recordType || 'case'
  const isLinked = recordType !== 'case'
  const linkedId = cas.data[`${recordType}Id`] as string | undefined
  const linkedRecords = store.usePosts(recordType) as PostRecord[]
  const linkedRecord = isLinked && linkedId ? linkedRecords.find(r => r.id === linkedId) : undefined
  const schema: SchemaField[] = node.data.fields || store.getType(recordType)?.schema || []
  const formDefaults = isLinked ? (linkedRecord?.data || {}) : (cas.data || {})
  const isComplete = (data: Record<string, unknown>) => schema.filter(f => f.required).every(f => !!data[f.key])
  const { bind, incomplete, submit } = sdk.useForm(formDefaults, {
    onSubmit: (data: Record<string, unknown>) => { submitStageData(store, cas, stage, data); sdk.log('Zapisano', 'ok') },
    isComplete, sync: isLinked ? linkedRecord?.data : cas.data,
  })
  const nextId = getNextStage(wf, node.id)
  return (
    <ui.Page><ui.Stage><ui.StageLayout
      top={<ui.Stack gap="md">
        <ui.StepHeading step={stepNum} title={title} subtitle={node.data.description} />
        {schema.map((f: SchemaField) => f.inputType?.startsWith('select:')
          ? <SelectField key={f.key} field={f} bind={bind} store={store} ui={ui} />
          : <ui.Field key={f.key} label={f.label} required={f.required}><ui.Input {...bind(f.key)} type={f.inputType} /></ui.Field>
        )}
      </ui.Stack>}
      bottom={<ui.Stack>
        {nextId && <ui.Button size="lg" color="primary" block disabled={incomplete} onClick={async () => { await submit(); advanceToStage(cas.id, nextId, wf) }}>Dalej</ui.Button>}
        {!nextId && <ui.Button size="lg" color="primary" block disabled={incomplete} onClick={submit}>Zapisz</ui.Button>}
      </ui.Stack>}
    /></ui.Stage></ui.Page>
  )
}

// ── View: DecisionView ───────────────────────────────────────────────

export function DecisionView({ node, cas, wf, ui, advanceToStage }: StageViewProps) {
  const title = (node.data.label || '').replace(/^\d+\.\s*/, '')
  return (
    <ui.Page><ui.Stage><ui.StageLayout
      top={<ui.StepHeading title={title} subtitle="Wybierz dalsze działanie" />}
      bottom={<ui.Stack>
        {wf.branches.filter((b: BranchDef) => b.from === node.id).map((b: BranchDef) => (
          <ui.Button key={b.to} size="lg" color="primary" outline block onClick={() => advanceToStage(cas.id, b.to, wf)}>{b.label || b.to}</ui.Button>
        ))}
      </ui.Stack>}
    /></ui.Stage></ui.Page>
  )
}

// ── View: TimelineView ───────────────────────────────────────────────

const TL_DOT: Record<string, string> = {
  etap: 'bg-success', termin: 'bg-warning', plik: 'bg-accent', notatka: 'bg-base-content/20', ocr: 'bg-info', chunks: 'bg-info',
}
const TL_ICON: Record<string, string> = {
  etap: 'ArrowRight', termin: 'Clock', plik: 'File', notatka: 'MessageSquare',
}

export function TimelineView({ node, cas, wf, ui, sdk, icons, store, uploadFile, downloadFile, useEvents, advanceToStage, getNextStage }: StageViewProps) {
  const stepNum = node.data.label?.match(/^(\d+)/)?.[1]
  const title = (node.data.label || '').replace(/^\d+\.\s*/, '')
  const events = useEvents(cas.id)
  const { form, bind, set } = sdk.useForm({ kind: 'notatka', text: '', date: '' })
  const KINDS = [{ value: 'notatka', label: 'Notatka' }, { value: 'termin', label: 'Termin' }]
  const nextId = getNextStage(wf, node.id)
  const addEvent = async () => {
    if (!(form.text as string).trim()) return
    await store.add('event', { kind: form.kind, text: (form.text as string).trim(), date: form.date, done: false }, { parentId: cas.id })
    set({ text: '', date: '' }); sdk.log(`Dodano ${form.kind}`, 'ok')
  }

  const EventIcon = ({ kind }: { kind: string }) => {
    const name = TL_ICON[kind] || 'Circle'
    const Icon = (icons as any)[name] || icons.Circle
    return <Icon size={10} />
  }

  return (
    <ui.Page><ui.Stage><ui.StageLayout
      top={<ui.Stack gap="md">
        <ui.StepHeading step={stepNum} title={title} subtitle={node.data.description} />
        <div className="relative pl-6 mt-4">
          {events.length > 1 && <div className="absolute left-[9px] top-3 bottom-3 w-px bg-base-content/10" />}
          {events.map((ev: PostRecord, i: number) => {
            const kind = ev.data.kind as string
            const date = ev.data.date || new Date(ev.createdAt).toISOString().slice(0, 10)
            const isFile = kind === 'plik'
            const isDeadline = kind === 'termin' && !ev.data.done
            return (
              <div key={ev.id} className={`relative flex items-start gap-3 group ${i < events.length - 1 ? 'pb-4' : ''}`}>
                <div className={`absolute -left-6 top-1 w-[19px] h-[19px] rounded-full flex items-center justify-center shrink-0 text-base-100 ${TL_DOT[kind] || 'bg-base-content/20'}`}>
                  <EventIcon kind={kind} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs leading-tight ${isFile ? 'cursor-pointer hover:text-accent' : ''}`}
                    onClick={isFile ? () => downloadFile(ev) : undefined}>
                    {ev.data.text}
                  </div>
                  <div className="text-2xs text-base-content/30 mt-0.5">{date}</div>
                </div>
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {isDeadline && <button className="btn btn-xs btn-success btn-square" onClick={() => store.update(ev.id, { done: true })}>✓</button>}
                  <ui.RemoveButton onClick={() => store.remove(ev.id)} />
                </div>
              </div>
            )
          })}
        </div>
      </ui.Stack>}
      bottom={<ui.Stack>
        <ui.Row>
          <ui.Select value={form.kind as string} options={KINDS} onChange={(e: { target: { value: string } }) => set('kind', e.target.value)} />
          <ui.Input {...bind('text')} placeholder="Treść..." onKeyDown={(e: { key: string }) => e.key === 'Enter' && addEvent()} />
          {form.kind === 'termin' && <ui.Input {...bind('date')} type="date" />}
          <ui.Button size="xs" color="primary" onClick={addEvent}>+</ui.Button>
          <ui.Button size="xs" color="ghost" onClick={() => uploadFile(cas.id)}><icons.Upload size={12} /></ui.Button>
        </ui.Row>
        {nextId && <ui.Button size="lg" color="primary" block onClick={() => advanceToStage(cas.id, nextId, wf)}>Dalej</ui.Button>}
      </ui.Stack>}
    /></ui.Stage></ui.Page>
  )
}

// ── View: GenericView ────────────────────────────────────────────────

export function GenericView({ node, cas, wf, ui, advanceToStage, getNextStage }: StageViewProps) {
  const stepNum = node.data.label?.match(/^(\d+)/)?.[1]
  const title = (node.data.label || '').replace(/^\d+\.\s*/, '')
  const nextId = getNextStage(wf, node.id)
  const cl = node.data.checklist || []
  return (
    <ui.Page><ui.Stage><ui.StageLayout
      top={<ui.Stack gap="md">
        <ui.StepHeading step={stepNum} title={title} subtitle={node.data.description} />
        {cl.length > 0 && cl.map((c: TaskDef, i: number) => <ui.CheckItem key={i} label={c.text} />)}
      </ui.Stack>}
      bottom={nextId ? <ui.Button size="lg" color="primary" block onClick={() => advanceToStage(cas.id, nextId, wf)}>Dalej</ui.Button> : undefined}
    /></ui.Stage></ui.Page>
  )
}
