/**
 * End-to-end test: simulates full WIBOR uproszczony workflow
 * without UI — uses the same functions the UI calls.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createStore } from './store'
import type { Store } from './store'
import {
  buildWorkflow, extractWorkflowSchema, getNextStage, submitStageData,
  type StageDef, type PostRecord, type WorkflowDef,
} from '../../packages/workflow-engine/src/engine'

// ── Load real workflow + opponent data ────────────────────────────────

const workflows: { type: string; data: any }[] =
  JSON.parse(readFileSync(resolve(__dirname, '../public/workflows.json'), 'utf-8'))

const opponents: { type: string; data: Record<string, unknown> }[] =
  JSON.parse(readFileSync(resolve(__dirname, '../public/opponents.json'), 'utf-8'))

// ── Helpers ──────────────────────────────────────────────────────────

function registerCrmTypes(store: Store) {
  store.registerType('client', [
    { key: 'name', label: 'Imię i nazwisko', required: true },
    { key: 'phone', label: 'Telefon', inputType: 'tel' },
    { key: 'email', label: 'Email', inputType: 'email' },
  ], 'Klienci', { validation: 'strict' })
  store.registerType('case', [
    { key: 'clientId', label: 'Klient (ID)' },
  ], 'Sprawy', { validation: 'warn' })
  store.registerType('event', [
    { key: 'kind', label: 'Rodzaj', required: true },
    { key: 'text', label: 'Treść' },
    { key: 'date', label: 'Data', inputType: 'date' },
    { key: 'done', label: 'Zakończone' },
  ], 'Zdarzenia', { validation: 'off' })
  store.registerType('workflow', [
    { key: 'wfId', label: 'ID', required: true },
    { key: 'name', label: 'Nazwa', required: true },
  ], 'Procesy', { validation: 'strict' })
  store.registerType('opponent', [
    { key: 'name', label: 'Nazwa', required: true },
    { key: 'opponentType', label: 'Typ' },
    { key: 'legalName', label: 'Nazwa prawna' },
    { key: 'krs', label: 'KRS' },
    { key: 'nip', label: 'NIP' },
    { key: 'address', label: 'Adres' },
    { key: 'formerNames', label: 'Dawne nazwy' },
  ], 'Banki', { validation: 'strict' })
}

async function importSeedData(store: Store) {
  await store.importJSON(workflows)
  await store.importJSON(opponents)
}

async function registerWorkflowSchemas(store: Store) {
  const exp = await store.exportJSON('workflow')
  for (const rec of exp.workflow?.records || []) {
    const wf = buildWorkflow(rec)
    for (const { type, fields } of extractWorkflowSchema(wf.stages)) {
      store.registerType(type, fields)
    }
  }
  store.registerType('case', [
    { key: 'workflowType', label: 'Proces' },
    { key: 'currentStage', label: 'Etap' },
    { key: 'status', label: 'Status' },
  ])
}

// ── Tests ────────────────────────────────────────────────────────────

let store: Store
let wf: WorkflowDef

beforeEach(async () => {
  store = createStore('e2e-' + Math.random())
  registerCrmTypes(store)
  await importSeedData(store)
  await registerWorkflowSchemas(store)
  // Build the "wibor-simple" workflow
  const exp = await store.exportJSON('workflow')
  const wfRec = exp.workflow.records.find(r => r.data.wfId === 'wibor-simple')!
  wf = buildWorkflow(wfRec)
})

describe('WIBOR uproszczony: full flow', () => {

  it('seed data loaded correctly', async () => {
    const exp = await store.exportJSON()
    expect(exp.workflow.records.length).toBe(2)
    expect(exp.opponent.records.length).toBe(10)
  })

  it('workflow has expected stages', () => {
    expect(wf.stages.map(s => s.id)).toEqual([
      'dokument', 'klient', 'sprawa', 'reklamacja', 'postepowanie', 'rozliczenie',
    ])
  })

  it('case schema includes workflow-derived fields + system fields', () => {
    const caseType = store.getType('case')!
    const keys = caseType.schema.map(f => f.key)
    // From workflow extract questions
    expect(keys).toContain('clientName')
    expect(keys).toContain('opponent')
    expect(keys).toContain('loanNumber')
    expect(keys).toContain('subject')
    // System fields
    expect(keys).toContain('workflowType')
    expect(keys).toContain('currentStage')
    expect(keys).toContain('status')
    // Linked record ref
    expect(keys).toContain('clientId')
  })

  it('client schema matches workflow klient stage fields', () => {
    const clientType = store.getType('client')!
    const keys = clientType.schema.map(f => f.key)
    expect(keys).toContain('name')
    expect(keys).toContain('phone')
  })

  it('step 1: create new case', async () => {
    const firstStage = wf.stages[0].id
    const cas = await store.add('case', {
      workflowType: wf.id, currentStage: firstStage, status: 'nowa',
    })
    await store.add('event', {
      kind: 'etap', text: `→ ${wf.name}`, date: '2026-03-25',
    }, { parentId: cas.id })

    const loaded = await store.get(cas.id)
    expect(loaded?.data.workflowType).toBe('wibor-simple')
    expect(loaded?.data.currentStage).toBe('dokument')
  })

  it('step 1→2: skip upload, advance to klient', async () => {
    const cas = await store.add('case', {
      workflowType: wf.id, currentStage: 'dokument', status: 'nowa',
    })
    const nextId = getNextStage(wf, 'dokument')
    expect(nextId).toBe('klient')
    await store.update(cas.id, { currentStage: nextId! })

    const loaded = await store.get(cas.id)
    expect(loaded?.data.currentStage).toBe('klient')
  })

  it('step 2: fill client form → creates linked client record', async () => {
    const cas = await store.add('case', {
      workflowType: wf.id, currentStage: 'klient', status: 'nowa',
    })
    const stage = wf.stages.find(s => s.id === 'klient')!
    expect(stage.recordType).toBe('client')

    const result = await submitStageData(store, cas, stage, {
      name: 'Jan Kowalski', phone: '123456789',
    })

    // Client record exists
    expect(result.linkedId).toBeTruthy()
    const client = await store.get(result.linkedId!)
    expect(client?.type).toBe('client')
    expect(client?.data.name).toBe('Jan Kowalski')
    expect(client?.data.phone).toBe('123456789')

    // Case references client
    const loadedCase = await store.get(cas.id)
    expect(loadedCase?.data.clientId).toBe(result.linkedId)

    // Client visible in plugin-data
    const exp = await store.exportJSON('client')
    expect(exp.client.records.length).toBe(1)
  })

  it('step 2 revisit: editing client updates existing record', async () => {
    const cas = await store.add('case', {
      workflowType: wf.id, currentStage: 'klient', status: 'nowa',
    })
    const stage = wf.stages.find(s => s.id === 'klient')!

    // First visit
    const r1 = await submitStageData(store, cas, stage, { name: 'Jan Kowalski' })
    const cas2 = await store.get(cas.id)

    // Revisit — should update, not create new
    const r2 = await submitStageData(store, cas2!, stage, { name: 'Jan Kowalski', phone: '999' })
    expect(r2.linkedId).toBe(r1.linkedId)

    const exp = await store.exportJSON('client')
    expect(exp.client.records.length).toBe(1) // still 1, not 2
    expect(exp.client.records[0].data.phone).toBe('999')
  })

  it('step 3: fill case data → saves to case record', async () => {
    const cas = await store.add('case', {
      workflowType: wf.id, currentStage: 'sprawa', status: 'nowa',
    })
    const stage = wf.stages.find(s => s.id === 'sprawa')!
    expect(stage.recordType).toBe('case')

    await submitStageData(store, cas, stage, {
      opponent: 'mBank', loanNumber: '2020/ABC/123',
      loanAmount: '350000', loanDate: '2020-06-15', subject: 'WIBOR',
    })

    const loaded = await store.get(cas.id)
    expect(loaded?.data.opponent).toBe('mBank')
    expect(loaded?.data.loanNumber).toBe('2020/ABC/123')
    expect(loaded?.data.loanAmount).toBe('350000')
    expect(loaded?.data.subject).toBe('WIBOR')
    // System fields preserved
    expect(loaded?.data.workflowType).toBe('wibor-simple')
    expect(loaded?.data.status).toBe('nowa')
  })

  it('full flow: dokument → klient → sprawa → all data correct', async () => {
    // Step 1: create case
    const cas = await store.add('case', {
      workflowType: wf.id, currentStage: 'dokument', status: 'nowa',
    })
    await store.add('event', { kind: 'etap', text: '→ WIBOR', date: '2026-03-25' }, { parentId: cas.id })

    // Step 1→2: advance
    await store.update(cas.id, { currentStage: 'klient' })

    // Step 2: client
    const klientStage = wf.stages.find(s => s.id === 'klient')!
    const { linkedId: clientId } = await submitStageData(store, (await store.get(cas.id))!, klientStage, {
      name: 'Anna Nowak', phone: '555111222',
    })
    await store.update(cas.id, { currentStage: 'sprawa' })

    // Step 3: case data
    const sprawaStage = wf.stages.find(s => s.id === 'sprawa')!
    await submitStageData(store, (await store.get(cas.id))!, sprawaStage, {
      opponent: 'PKO BP', loanNumber: '2019/XY/456', loanAmount: '500000',
      loanDate: '2019-03-10', subject: 'Kredyt hipoteczny WIBOR',
    })
    await store.update(cas.id, { currentStage: 'reklamacja' })

    // Final verification
    const finalCase = await store.get(cas.id)!
    expect(finalCase?.data.workflowType).toBe('wibor-simple')
    expect(finalCase?.data.currentStage).toBe('reklamacja')
    expect(finalCase?.data.clientId).toBe(clientId)
    expect(finalCase?.data.opponent).toBe('PKO BP')
    expect(finalCase?.data.loanNumber).toBe('2019/XY/456')
    expect(finalCase?.data.subject).toBe('Kredyt hipoteczny WIBOR')

    const client = await store.get(clientId!)
    expect(client?.data.name).toBe('Anna Nowak')
    expect(client?.data.phone).toBe('555111222')

    // Events
    const expEvents = await store.exportJSON('event')
    expect(expEvents.event.records.length).toBe(1)

    // Both types visible in plugin-data
    const expAll = await store.exportJSON()
    expect(expAll.case.records.length).toBe(1)
    expect(expAll.client.records.length).toBe(1)
    expect(expAll.opponent.records.length).toBe(10)
  })
})
