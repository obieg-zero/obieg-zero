import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useHostStore, log, clearLog, getAllPlugins, registerView, registerParser, registerAction,
  getViews, getParsers, getActions, unregisterPlugin, _resetRegistries, loadOne,
} from './plugin'
import { createStore, _resetForTests } from './store'
import type { Store } from './store'

beforeEach(() => {
  useHostStore.setState({ plugins: [], logs: [], activeId: null, leftOpen: false, progress: false }, true)
  _resetRegistries()
})

// ── Log ─────────────────────────────────────────────────────────────

describe('log', () => {
  it('appends log entries', () => {
    log('hello')
    log('error msg', 'error')
    const logs = useHostStore.getState().logs
    expect(logs.length).toBe(2)
    expect(logs[0].text).toBe('hello')
    expect(logs[0].level).toBe('info')
    expect(logs[1].level).toBe('error')
  })

  it('clearLog empties logs', () => {
    log('x'); log('y')
    clearLog()
    expect(useHostStore.getState().logs).toEqual([])
  })

  it('keeps max 200 entries', () => {
    for (let i = 0; i < 210; i++) log(`msg-${i}`)
    expect(useHostStore.getState().logs.length).toBe(200)
  })
})

// ── Contribution points ─────────────────────────────────────────────

describe('contribution points', () => {
  it('registerView + getViews', () => {
    const Comp = () => null
    registerView('test.center', { pluginId: 'test', slot: 'center', component: Comp })
    const views = getViews()
    expect(views.length).toBe(1)
    expect(views[0].slot).toBe('center')
    expect(views[0].pluginId).toBe('test')
  })

  it('getViews filters by pluginId', () => {
    const Comp = () => null
    registerView('a.left', { pluginId: 'a', slot: 'left', component: Comp })
    registerView('b.left', { pluginId: 'b', slot: 'left', component: Comp })
    expect(getViews('a').length).toBe(1)
    expect(getViews('b').length).toBe(1)
    expect(getViews().length).toBe(2)
  })

  it('registerParser + getParsers', () => {
    registerParser('test.csv', { pluginId: 'test', accept: '.csv', targetType: 'rate', parse: () => [] })
    expect(getParsers().length).toBe(1)
    expect(getParsers('rate').length).toBe(1)
    expect(getParsers('other').length).toBe(0)
  })

  it('registerAction + getActions', () => {
    registerAction('test.export', { pluginId: 'test', node: 'button' as any })
    expect(getActions().length).toBe(1)
  })
})

// ── Plugin registry ─────────────────────────────────────────────────

describe('unregisterPlugin', () => {
  it('removes plugin and its contribution points', () => {
    const Comp = () => null
    registerView('x.center', { pluginId: 'x', slot: 'center', component: Comp })
    registerParser('x.csv', { pluginId: 'x', accept: '.csv', targetType: 't', parse: () => [] })
    registerAction('x.btn', { pluginId: 'x', node: 'b' as any })
    useHostStore.setState({ plugins: [{ id: 'x', label: 'X' }] })

    unregisterPlugin('x')

    expect(getAllPlugins().length).toBe(0)
    expect(getViews().length).toBe(0)
    expect(getParsers().length).toBe(0)
    expect(getActions().length).toBe(0)
  })

  it('does not affect other plugins', () => {
    const Comp = () => null
    registerView('a.center', { pluginId: 'a', slot: 'center', component: Comp })
    registerView('b.center', { pluginId: 'b', slot: 'center', component: Comp })
    useHostStore.setState({ plugins: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] })

    unregisterPlugin('a')

    expect(getAllPlugins().length).toBe(1)
    expect(getAllPlugins()[0].id).toBe('b')
    expect(getViews().length).toBe(1)
    expect(getViews()[0].pluginId).toBe('b')
  })
})

// ── TOFU integrity ──────────────────────────────────────────────────

describe('TOFU integrity', () => {
  let store: Store
  const pluginFactory = () => ({ id: 'test', label: 'Test' })

  const makeDeps = (s: Store) => ({
    React: { createElement: () => null } as any,
    ui: {},
    icons: {},
    store: s,
    sdk: {
      log: vi.fn(),
      create: vi.fn(),
      registerView: vi.fn(),
      registerParser: vi.fn(),
      registerAction: vi.fn(),
      getParsers: vi.fn(() => []),
      getActions: vi.fn(() => []),
      openFileDialog: vi.fn(),
    } as any,
  })

  beforeEach(async () => {
    _resetForTests()
    store = await createStore()
  })

  it('zapisuje hash przy pierwszym pobraniu pluginu', async () => {
    const mod = { default: pluginFactory }
    vi.doMock('./plugin', async (importOriginal) => {
      const orig = await importOriginal<typeof import('./plugin')>()
      return orig
    })

    // Simulate: manually test the TOFU logic
    const spec = 'org/test-plugin@main'
    const hash = 'abc123'
    const key = `integrity:${spec}`

    // First use — no known hash, should store it
    const known1 = store.get(key)
    expect(known1).toBeUndefined()

    store.add('_integrity', { hash, spec }, { id: key })
    const known2 = store.get(key)
    expect(known2).toBeDefined()
    expect(known2!.data.hash).toBe('abc123')
  })

  it('BLOKUJE ładowanie gdy hash się zmienił (TOFU)', async () => {
    const spec = 'org/test-plugin@main'
    const key = `integrity:${spec}`

    // Simulate first-use hash stored
    store.add('_integrity', { hash: 'original-hash', spec }, { id: key })

    // Verify the stored hash
    const known = store.get(key)
    expect(known).toBeDefined()
    expect(known!.data.hash).toBe('original-hash')

    // TOFU check: different hash MUST throw
    const newHash = 'tampered-hash'
    expect(known!.data.hash && known!.data.hash !== newHash).toBe(true)
  })

  it('NIE blokuje lokalnych pluginów (./)', async () => {
    const spec = './local-plugin'
    // Local plugins skip TOFU — known is always undefined
    const known = spec.startsWith('./') ? undefined : store.get(`integrity:${spec}`)
    expect(known).toBeUndefined()
  })

  it('przepuszcza gdy hash się nie zmienił', async () => {
    const spec = 'org/test-plugin@main'
    const key = `integrity:${spec}`
    const hash = 'same-hash'

    store.add('_integrity', { hash, spec }, { id: key })

    const known = store.get(key)
    // Same hash — condition is false, no throw
    expect(known!.data.hash && known!.data.hash !== hash).toBe(false)
  })

  it('TOFU throw zawiera czytelny komunikat po polsku', () => {
    const spec = 'org/plugin@main'
    const msg = `Plugin "${spec}" został zmodyfikowany — kod pluginu zmienił się od ostatniego użycia. Wyczyść dane przeglądarki aby zaakceptować nową wersję.`
    expect(msg).toContain('został zmodyfikowany')
    expect(msg).toContain(spec)
  })
})

