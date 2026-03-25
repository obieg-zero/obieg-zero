import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from './store'
import type { Store } from './store'

let store: Store

beforeEach(() => {
  store = createStore('test-' + Math.random())
})

describe('CRM workflow: case filled in stages', () => {
  beforeEach(() => {
    store.registerType('case', [], 'Sprawy', { validation: 'warn' })
    // Workflow dynamically adds fields to case
    store.registerType('case', [
      { key: 'clientName', label: 'Klient', required: true },
      { key: 'opponent', label: 'Bank' },
      { key: 'loanNumber', label: 'Nr umowy' },
    ])
    // System fields added last
    store.registerType('case', [
      { key: 'workflowType', label: 'Proces' },
      { key: 'currentStage', label: 'Etap' },
      { key: 'status', label: 'Status' },
    ])
  })

  it('step 1: create case with only system fields', async () => {
    const rec = await store.add('case', {
      workflowType: 'wibor-simple',
      currentStage: 'dokumenty',
      status: 'nowa',
    })
    expect(rec.id).toBeTruthy()
    const loaded = await store.get(rec.id)
    expect(loaded?.data.workflowType).toBe('wibor-simple')
    expect(loaded?.data.clientName).toBeUndefined() // not yet filled
  })

  it('step 2: update case with client data', async () => {
    const rec = await store.add('case', {
      workflowType: 'wibor-simple',
      currentStage: 'klient',
      status: 'nowa',
    })
    await store.update(rec.id, { clientName: 'Jan Kowalski' })
    const loaded = await store.get(rec.id)
    expect(loaded?.data.clientName).toBe('Jan Kowalski')
    expect(loaded?.data.workflowType).toBe('wibor-simple') // preserved
  })

  it('step 3: update case with loan data, previous fields preserved', async () => {
    const rec = await store.add('case', {
      workflowType: 'wibor-simple',
      currentStage: 'klient',
      status: 'nowa',
    })
    await store.update(rec.id, { clientName: 'Jan Kowalski' })
    await store.update(rec.id, { opponent: 'Bank X', loanNumber: '123/2024', currentStage: 'sprawa' })

    const loaded = await store.get(rec.id)
    expect(loaded?.data.clientName).toBe('Jan Kowalski') // still there?
    expect(loaded?.data.opponent).toBe('Bank X')
    expect(loaded?.data.loanNumber).toBe('123/2024')
    expect(loaded?.data.currentStage).toBe('sprawa')
  })
})

describe('CRM workflow: exact production sequence', () => {
  // Simulates exactly what plugin-workflow-crm does at boot + user actions

  it('full flow: register types → add case → update stages → read back', async () => {
    // 1. Plugin registers types synchronously (index.tsx lines 14-40)
    store.registerType('client', [
      { key: 'name', label: 'Imię i nazwisko', required: true },
    ], 'Klienci', { validation: 'strict' })
    store.registerType('case', [], 'Sprawy', { validation: 'warn' })
    store.registerType('event', [
      { key: 'kind', label: 'Rodzaj', required: true },
    ], 'Zdarzenia', { validation: 'off' })

    // 2. Async: workflow-derived fields added to case (index.tsx lines 52-64)
    store.registerType('case', [
      { key: 'clientName', label: 'Klient' },
      { key: 'opponent', label: 'Bank' },
      { key: 'loanNumber', label: 'Nr umowy' },
    ])
    store.registerType('case', [
      { key: 'workflowType', label: 'Proces' },
      { key: 'currentStage', label: 'Etap' },
      { key: 'status', label: 'Status' },
    ])

    // 3. User clicks "Nowa sprawa" (panels.tsx line 37)
    const cas = await store.add('case', {
      workflowType: 'wibor-simple',
      currentStage: 'dokumenty',
      status: 'nowa',
    })
    expect(cas.id).toBeTruthy()

    // 4. Event logged (panels.tsx line 38)
    const ev = await store.add('event', {
      kind: 'etap',
      text: '→ WIBOR uproszczony',
      date: '2026-03-25',
    }, { parentId: cas.id })
    expect(ev.parentId).toBe(cas.id)

    // 5. User fills client step (stage-views.tsx FormView → store.update)
    await store.update(cas.id, { clientName: 'Jan Kowalski' })

    // 6. User fills case data step
    await store.update(cas.id, {
      opponent: 'Bank X',
      loanNumber: '123/2024',
      currentStage: 'sprawa',
    })

    // 7. Verify everything is there
    const final = await store.get(cas.id)
    expect(final).toBeDefined()
    expect(final!.data.workflowType).toBe('wibor-simple')
    expect(final!.data.clientName).toBe('Jan Kowalski')
    expect(final!.data.opponent).toBe('Bank X')
    expect(final!.data.loanNumber).toBe('123/2024')
    expect(final!.data.currentStage).toBe('sprawa')
    expect(final!.data.status).toBe('nowa')

    // 8. Verify case is queryable by type
    const allCases = await store.exportJSON('case')
    expect(allCases.case.records.length).toBe(1)
    expect(allCases.case.records[0].data.clientName).toBe('Jan Kowalski')
  })
})

describe('CRM workflow: client as linked record', () => {
  beforeEach(() => {
    store.registerType('client', [
      { key: 'name', label: 'Imię i nazwisko', required: true },
      { key: 'phone', label: 'Telefon' },
    ], 'Klienci', { validation: 'strict' })
    store.registerType('case', [
      { key: 'workflowType', label: 'Proces' },
      { key: 'currentStage', label: 'Etap' },
      { key: 'status', label: 'Status' },
      { key: 'clientId', label: 'Klient' },
    ], 'Sprawy', { validation: 'warn' })
  })

  it('creates client record and links to case via clientId', async () => {
    // 1. Create case
    const cas = await store.add('case', {
      workflowType: 'wibor-simple', currentStage: 'klient', status: 'nowa',
    })

    // 2. FormView with recordType "client" creates separate record
    const client = await store.add('client', { name: 'Jan Kowalski', phone: '123456789' })

    // 3. Links client to case
    await store.update(cas.id, { clientId: client.id })

    // 4. Case has clientId, not clientName
    const loadedCase = await store.get(cas.id)
    expect(loadedCase?.data.clientId).toBe(client.id)
    expect(loadedCase?.data.clientName).toBeUndefined()

    // 5. Client exists as separate record
    const loadedClient = await store.get(client.id)
    expect(loadedClient?.data.name).toBe('Jan Kowalski')
    expect(loadedClient?.type).toBe('client')

    // 6. Client visible in exportJSON
    const exp = await store.exportJSON('client')
    expect(exp.client.records.length).toBe(1)
    expect(exp.client.records[0].data.name).toBe('Jan Kowalski')
  })

  it('updates existing linked client', async () => {
    const cas = await store.add('case', {
      workflowType: 'wibor-simple', currentStage: 'klient', status: 'nowa',
    })
    const client = await store.add('client', { name: 'Jan Kowalski' })
    await store.update(cas.id, { clientId: client.id })

    // User goes back to client step and edits
    await store.update(client.id, { phone: '999888777' })

    const loaded = await store.get(client.id)
    expect(loaded?.data.name).toBe('Jan Kowalski')
    expect(loaded?.data.phone).toBe('999888777')
  })
})

describe('validation modes per type', () => {
  it('strict: throws on missing required field', async () => {
    store.registerType('client', [
      { key: 'name', label: 'Nazwa', required: true },
    ], 'Klienci', { validation: 'strict' })

    await expect(store.add('client', {})).rejects.toThrow('Missing required field: name')
  })

  it('warn: allows missing required field', async () => {
    store.registerType('case', [
      { key: 'name', label: 'Nazwa', required: true },
    ], 'Sprawy', { validation: 'warn' })

    const rec = await store.add('case', {})
    expect(rec.id).toBeTruthy()
  })

  it('off: no validation at all', async () => {
    store.registerType('event', [
      { key: 'kind', label: 'Rodzaj', required: true },
    ], 'Zdarzenia', { validation: 'off' })

    const rec = await store.add('event', { whatever: 'anything' })
    expect(rec.id).toBeTruthy()
  })

  it('strict on update: throws if merged data invalid', async () => {
    store.registerType('client', [
      { key: 'name', label: 'Nazwa', required: true },
    ], 'Klienci', { validation: 'strict' })

    const rec = await store.add('client', { name: 'Jan' })
    await expect(store.update(rec.id, { name: '' })).rejects.toThrow('Missing required field: name')
  })

  it('default validation mode is warn', async () => {
    store.registerType('misc', [
      { key: 'x', label: 'X', required: true },
    ], 'Misc')

    const rec = await store.add('misc', {})
    expect(rec.id).toBeTruthy() // warn doesn't throw
  })
})
