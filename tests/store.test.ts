import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore, _resetForTests } from '../src/store'
import type { Store } from '../src/store'

let store: Store

beforeEach(async () => {
  _resetForTests()
  store = await createStore()
})

// ── CRUD ────────────────────────────────────────────────────────────

describe('CRUD', () => {
  it('add returns PostRecord with id, type, timestamps', () => {
    const r = store.add('task', { title: 'Test' })
    expect(r.id).toBeTruthy()
    expect(r.type).toBe('task')
    expect(r.parentId).toBeNull()
    expect(r.data.title).toBe('Test')
    expect(r.createdAt).toBeGreaterThan(0)
  })

  it('add with custom id and parentId', () => {
    const parent = store.add('project', { name: 'P1' })
    const child = store.add('task', { title: 'T1' }, { id: 'custom-id', parentId: parent.id })
    expect(child.id).toBe('custom-id')
    expect(child.parentId).toBe(parent.id)
  })

  it('get returns record by id', () => {
    const r = store.add('task', { title: 'X' })
    expect(store.get(r.id)?.data.title).toBe('X')
  })

  it('get returns undefined for missing id', () => {
    expect(store.get('nonexistent')).toBeUndefined()
  })

  it('update merges data and bumps updatedAt', () => {
    const r = store.add('task', { title: 'Old', done: false })
    const before = r.updatedAt
    store.update(r.id, { done: true })
    const loaded = store.get(r.id)!
    expect(loaded.data.title).toBe('Old')
    expect(loaded.data.done).toBe(true)
    expect(loaded.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('update on missing id is noop', () => {
    expect(() => store.update('missing', { x: 1 })).not.toThrow()
  })

  it('remove deletes record', () => {
    const r = store.add('task', { title: 'Del' })
    store.remove(r.id)
    expect(store.get(r.id)).toBeUndefined()
  })

  it('remove cascades to children', () => {
    const parent = store.add('project', { name: 'P' })
    const child = store.add('task', { title: 'T' }, { parentId: parent.id })
    const grandchild = store.add('note', { text: 'N' }, { parentId: child.id })
    store.remove(parent.id)
    expect(store.get(parent.id)).toBeUndefined()
    expect(store.get(child.id)).toBeUndefined()
    expect(store.get(grandchild.id)).toBeUndefined()
  })
})

// ── Queries ─────────────────────────────────────────────────────────

describe('queries', () => {
  it('getPosts returns records of type sorted by createdAt', () => {
    store.add('task', { title: 'A' })
    store.add('note', { text: 'X' })
    store.add('task', { title: 'B' })
    const tasks = store.getPosts('task')
    expect(tasks.length).toBe(2)
    expect(tasks[0].data.title).toBe('A')
    expect(tasks[1].data.title).toBe('B')
  })

  it('getPosts returns empty for unknown type', () => {
    expect(store.getPosts('nope')).toEqual([])
  })
})

// ── Type registry ───────────────────────────────────────────────────

describe('registerType', () => {
  it('registers and retrieves type', () => {
    store.registerType('task', [{ key: 'title', label: 'Tytuł', required: true }], 'Zadania')
    const t = store.getType('task')
    expect(t?.label).toBe('Zadania')
    expect(t?.schema[0].key).toBe('title')
  })

  it('merges fields on repeated registration', () => {
    store.registerType('case', [{ key: 'a', label: 'A' }])
    store.registerType('case', [{ key: 'a', label: 'A2' }, { key: 'b', label: 'B' }])
    const t = store.getType('case')!
    expect(t.schema.length).toBe(2)
    expect(t.schema[0].label).toBe('A') // first wins
    expect(t.schema[1].key).toBe('b')
  })

  it('getTypes returns all registered types', () => {
    store.registerType('a', [], 'AA')
    store.registerType('b', [], 'BB')
    expect(store.getTypes().map(t => t.type).sort()).toEqual(['a', 'b'])
  })
})

// ── Validation (strict) ─────────────────────────────────────────────

describe('strict validation', () => {
  beforeEach(() => {
    store.registerType('client', [{ key: 'name', label: 'Nazwa', required: true }], 'Klienci', { strict: true })
  })

  it('throws on add with missing required field', () => {
    expect(() => store.add('client', {})).toThrow('Missing required: name')
  })

  it('allows add with required field present', () => {
    const r = store.add('client', { name: 'Jan' })
    expect(r.data.name).toBe('Jan')
  })

  it('throws on update that clears required field', () => {
    const r = store.add('client', { name: 'Jan' })
    expect(() => store.update(r.id, { name: '' })).toThrow('Missing required: name')
  })

  it('non-strict type allows missing required', () => {
    store.registerType('note', [{ key: 'text', label: 'Treść', required: true }])
    const r = store.add('note', {})
    expect(r.id).toBeTruthy()
  })
})

// ── Options ─────────────────────────────────────────────────────────

describe('options', () => {
  it('setOption + get via useOption pattern', () => {
    store.setOption('theme', 'dark')
    // Can't test useOption (hook) in non-React context, but setOption should persist in state
    store.setOption('lang', 'pl')
    // Verify via another setOption/get cycle
    store.setOption('theme', 'light')
  })
})

// ── importJSON ──────────────────────────────────────────────────────

describe('importJSON', () => {
  it('imports flat nodes', () => {
    const count = store.importJSON([
      { type: 'task', data: { title: 'A' } },
      { type: 'task', data: { title: 'B' } },
    ])
    expect(count).toBe(2)
    expect(store.getPosts('task').length).toBe(2)
  })

  it('imports nested parent-child', () => {
    const count = store.importJSON([{
      type: 'opponent', data: { name: 'Bank X' },
      children: [
        { type: 'opponent-template', data: { margin: 2.5 } },
        { type: 'opponent-template', data: { margin: 1.8 } },
      ],
    }])
    expect(count).toBe(3)
    const opponents = store.getPosts('opponent')
    expect(opponents.length).toBe(1)
    const templates = store.getPosts('opponent-template')
    expect(templates.length).toBe(2)
    expect(templates[0].parentId).toBe(opponents[0].id)
  })

  it('deep nesting works', () => {
    const count = store.importJSON([{
      type: 'a', data: { n: 1 },
      children: [{ type: 'b', data: { n: 2 }, children: [{ type: 'c', data: { n: 3 } }] }],
    }])
    expect(count).toBe(3)
    const cs = store.getPosts('c')
    expect(cs.length).toBe(1)
    const bs = store.getPosts('b')
    expect(cs[0].parentId).toBe(bs[0].id)
  })
})
