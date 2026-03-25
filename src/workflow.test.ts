import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from './store'
import type { Store } from './store'
import { submitStageData } from '../../packages/workflow-engine/src/engine'
import type { StageDef, PostRecord } from '../../packages/workflow-engine/src/engine'

let store: Store

beforeEach(() => {
  store = createStore('test-' + Math.random())
  store.registerType('client', [
    { key: 'name', label: 'Imię i nazwisko', required: true },
    { key: 'phone', label: 'Telefon' },
    { key: 'email', label: 'Email' },
  ], 'Klienci', { validation: 'strict' })
  store.registerType('case', [
    { key: 'clientId', label: 'Klient (ID)' },
    { key: 'workflowType', label: 'Proces' },
    { key: 'currentStage', label: 'Etap' },
    { key: 'status', label: 'Status' },
    { key: 'opponent', label: 'Bank' },
    { key: 'loanNumber', label: 'Nr umowy' },
    { key: 'loanAmount', label: 'Kwota' },
    { key: 'loanDate', label: 'Data umowy' },
    { key: 'subject', label: 'Przedmiot' },
  ], 'Sprawy', { validation: 'warn' })
  store.registerType('event', [
    { key: 'kind', label: 'Rodzaj', required: true },
    { key: 'text', label: 'Treść' },
    { key: 'date', label: 'Data' },
    { key: 'done', label: 'Zakończone' },
  ], 'Zdarzenia', { validation: 'off' })
})

async function createCase(): Promise<PostRecord> {
  return store.add('case', {
    workflowType: 'wibor-simple', currentStage: 'dokument', status: 'nowa',
  })
}

describe('submitStageData', () => {

  describe('recordType: case (default)', () => {
    const stage: StageDef = {
      id: 'sprawa', label: '3. Dane sprawy', view: 'form', recordType: 'case',
      fields: [
        { key: 'opponent', label: 'Bank', required: true },
        { key: 'loanNumber', label: 'Nr umowy' },
        { key: 'loanAmount', label: 'Kwota', inputType: 'number' },
        { key: 'loanDate', label: 'Data umowy', inputType: 'date' },
        { key: 'subject', label: 'Przedmiot', required: true },
      ],
    }

    it('saves data directly to case record', async () => {
      const cas = await createCase()
      await submitStageData(store, cas, stage, {
        opponent: 'Bank X', loanNumber: '123/2024', loanAmount: '50000', loanDate: '2020-01-15', subject: 'WIBOR',
      })
      const loaded = await store.get(cas.id)
      expect(loaded?.data.opponent).toBe('Bank X')
      expect(loaded?.data.loanNumber).toBe('123/2024')
      expect(loaded?.data.subject).toBe('WIBOR')
      // system fields preserved
      expect(loaded?.data.workflowType).toBe('wibor-simple')
      expect(loaded?.data.status).toBe('nowa')
    })

    it('preserves existing case fields on partial update', async () => {
      const cas = await createCase()
      await submitStageData(store, cas, stage, { opponent: 'Bank X', subject: 'WIBOR' })
      // Second stage update
      await submitStageData(store, cas, { ...stage, id: 'extra' }, { loanAmount: '100000' })
      const loaded = await store.get(cas.id)
      expect(loaded?.data.opponent).toBe('Bank X')
      expect(loaded?.data.loanAmount).toBe('100000')
    })
  })

  describe('recordType: client (linked record)', () => {
    const stage: StageDef = {
      id: 'klient', label: '2. Klient', view: 'form', recordType: 'client',
      fields: [
        { key: 'name', label: 'Imię i nazwisko', required: true },
        { key: 'phone', label: 'Telefon', inputType: 'tel' },
      ],
    }

    it('creates client record and links to case', async () => {
      const cas = await createCase()
      const result = await submitStageData(store, cas, stage, { name: 'Jan Kowalski', phone: '123456789' })

      // client created
      expect(result.linkedId).toBeTruthy()
      const client = await store.get(result.linkedId!)
      expect(client?.type).toBe('client')
      expect(client?.data.name).toBe('Jan Kowalski')
      expect(client?.data.phone).toBe('123456789')

      // case has clientId
      const loadedCase = await store.get(cas.id)
      expect(loadedCase?.data.clientId).toBe(result.linkedId)
    })

    it('updates existing client if already linked', async () => {
      const cas = await createCase()
      // First visit: create client
      const r1 = await submitStageData(store, cas, stage, { name: 'Jan Kowalski' })
      // Reload case (simulate React re-render)
      const cas2 = await store.get(cas.id)
      // Second visit: update client
      const r2 = await submitStageData(store, cas2!, stage, { name: 'Jan Kowalski', phone: '999888777' })

      expect(r2.linkedId).toBe(r1.linkedId) // same record
      const client = await store.get(r1.linkedId!)
      expect(client?.data.phone).toBe('999888777')
    })

    it('client visible in store by type', async () => {
      const cas = await createCase()
      await submitStageData(store, cas, stage, { name: 'Anna Nowak', phone: '111222333' })

      const exp = await store.exportJSON('client')
      expect(exp.client.records.length).toBe(1)
      expect(exp.client.records[0].data.name).toBe('Anna Nowak')
    })
  })

  describe('full workflow sequence', () => {
    it('dokument → klient → dane sprawy → all data persisted', async () => {
      const cas = await createCase()

      // Step 1: dokument (upload — skip for this test, just advance)
      await store.update(cas.id, { currentStage: 'klient' })

      // Step 2: klient
      const clientStage: StageDef = { id: 'klient', label: '2. Klient', view: 'form', recordType: 'client',
        fields: [{ key: 'name', label: 'Imię i nazwisko', required: true }, { key: 'phone', label: 'Telefon' }] }
      const { linkedId } = await submitStageData(store, (await store.get(cas.id))!, clientStage, { name: 'Jan Kowalski', phone: '123' })
      await store.update(cas.id, { currentStage: 'sprawa' })

      // Step 3: dane sprawy
      const caseStage: StageDef = { id: 'sprawa', label: '3. Dane sprawy', view: 'form', recordType: 'case',
        fields: [{ key: 'opponent', label: 'Bank', required: true }, { key: 'loanNumber', label: 'Nr umowy' }, { key: 'subject', label: 'Przedmiot', required: true }] }
      await submitStageData(store, (await store.get(cas.id))!, caseStage, { opponent: 'Bank X', loanNumber: '123/2024', subject: 'WIBOR' })

      // Verify everything
      const finalCase = await store.get(cas.id)
      expect(finalCase?.data.clientId).toBe(linkedId)
      expect(finalCase?.data.opponent).toBe('Bank X')
      expect(finalCase?.data.loanNumber).toBe('123/2024')
      expect(finalCase?.data.subject).toBe('WIBOR')
      expect(finalCase?.data.workflowType).toBe('wibor-simple')

      const client = await store.get(linkedId!)
      expect(client?.data.name).toBe('Jan Kowalski')

      // Both visible in exports
      const expCase = await store.exportJSON('case')
      const expClient = await store.exportJSON('client')
      expect(expCase.case.records.length).toBe(1)
      expect(expClient.client.records.length).toBe(1)
    })
  })
})
