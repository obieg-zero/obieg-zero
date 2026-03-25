import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { extractWorkflowSchema, type StageDef } from '../../packages/workflow-engine/src/engine'

// ── Load data ───────────────────────────────────────────────────────

const workflowsPath = resolve(__dirname, '../public/workflows.json')
const workflows: { type: string; data: { wfId: string; name: string; stages: StageDef[] } }[] =
  JSON.parse(readFileSync(workflowsPath, 'utf-8'))

const opponentsPath = resolve(__dirname, '../public/opponents.json')
const opponents: { type: string; data: Record<string, unknown> }[] =
  JSON.parse(readFileSync(opponentsPath, 'utf-8'))

// ── Plugin-contributed schemas (system fields only) ─────────────────

const pluginSchemas: Record<string, string[]> = {
  case: ['workflowType', 'currentStage', 'status'], // registered after workflow fields at runtime
  event: ['kind', 'text', 'date', 'done'],
  client: ['name', 'phone', 'email'],
  workflow: ['wfId', 'name'],
  opponent: ['name', 'opponentType', 'legalName', 'krs', 'nip', 'address', 'formerNames'],
}

// ── Build merged schema (plugin + workflow-derived) ─────────────────

function buildMergedSchema(): Record<string, Set<string>> {
  const merged: Record<string, Set<string>> = {}
  for (const [type, keys] of Object.entries(pluginSchemas)) {
    merged[type] = new Set(keys)
  }
  for (const wf of workflows) {
    for (const { type, fields } of extractWorkflowSchema(wf.data.stages)) {
      if (!merged[type]) merged[type] = new Set()
      for (const f of fields) merged[type].add(f.key)
    }
  }
  return merged
}

const mergedSchema = buildMergedSchema()

// ── Tests ───────────────────────────────────────────────────────────

describe('workflow fields are resolvable to a type schema', () => {
  for (const wf of workflows) {
    describe(`workflow "${wf.data.name}"`, () => {
      for (const stage of wf.data.stages) {
        const targetType = stage.recordType || 'case'

        if (stage.fields) {
          it(`stage "${stage.id}" fields → registered in "${targetType}"`, () => {
            const known = mergedSchema[targetType] || new Set()
            const missing = stage.fields!.map(f => f.key).filter(k => !known.has(k))
            expect(missing, `fields not in merged ${targetType} schema`).toEqual([])
          })
        }

        const questions = stage.pipeline?.extract?.questions
        if (questions) {
          it(`stage "${stage.id}" extract keys → registered in "${targetType}"`, () => {
            const known = mergedSchema[targetType] || new Set()
            const missing = Object.keys(questions).filter(k => !known.has(k))
            expect(missing, `extract keys not in merged ${targetType} schema`).toEqual([])
          })
        }
      }
    })
  }
})

describe('seed data vs type schemas', () => {
  it('opponent records only use fields from opponent schema', () => {
    const known = mergedSchema.opponent || new Set()
    const extra = new Set<string>()
    for (const o of opponents) {
      if (o.type !== 'opponent') continue
      for (const k of Object.keys(o.data)) {
        if (!known.has(k)) extra.add(k)
      }
    }
    expect([...extra], 'opponent fields not in schema').toEqual([])
  })
})

describe('extractWorkflowSchema produces correct fields', () => {
  it('extracts fields from stage.fields', () => {
    const result = extractWorkflowSchema([
      { id: 's1', label: 'Test', fields: [{ key: 'foo', label: 'Foo' }, { key: 'bar', label: 'Bar' }] },
    ])
    expect(result).toEqual([{ type: 'case', fields: [{ key: 'foo', label: 'Foo' }, { key: 'bar', label: 'Bar' }] }])
  })

  it('extracts keys from extract.questions', () => {
    const result = extractWorkflowSchema([
      { id: 's1', label: 'Test', pipeline: { extract: { from: 'x', method: 'api', questions: { a: 'Q1', b: 'Q2' } } } },
    ])
    expect(result[0].fields.map(f => f.key)).toEqual(['a', 'b'])
  })

  it('deduplicates fields from multiple stages', () => {
    const result = extractWorkflowSchema([
      { id: 's1', label: 'A', fields: [{ key: 'x', label: 'X' }] },
      { id: 's2', label: 'B', fields: [{ key: 'x', label: 'X2' }, { key: 'y', label: 'Y' }] },
    ])
    expect(result[0].fields.map(f => f.key)).toEqual(['x', 'y'])
    expect(result[0].fields[0].label).toBe('X') // first wins
  })

  it('groups by recordType', () => {
    const result = extractWorkflowSchema([
      { id: 's1', label: 'A', recordType: 'case', fields: [{ key: 'a', label: 'A' }] },
      { id: 's2', label: 'B', recordType: 'client', fields: [{ key: 'b', label: 'B' }] },
    ])
    expect(result.map(r => r.type).sort()).toEqual(['case', 'client'])
  })
})
