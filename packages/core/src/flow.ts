import type { ModuleDef } from './module.js';
import { getDefaults } from './module.js';

export type Vars = Record<string, any>;

export interface FlowContext {
  get(key: string): any;
  set(key: string, value: any): void;
  progress(status: string, pct?: number): void;
}

export interface NodeDef {
  run(ctx: FlowContext): Promise<void>;
  dispose?(): void;
  reads?: string[];
  writes?: string[];
}

export interface CacheAdapter {
  get(key: string): Promise<Record<string, any> | undefined>;
  set(key: string, values: Record<string, any>): Promise<void>;
  clear(): Promise<void>;
}

export type FlowEvent =
  | { type: 'vars'; key: string; value: any }
  | { type: 'node:start'; id: string }
  | { type: 'node:done'; id: string }
  | { type: 'node:error'; id: string; error: string }
  | { type: 'progress'; id: string; status: string; pct?: number };

export type FlowListener = (event: FlowEvent) => void;

export interface RegisteredModule {
  def: ModuleDef;
  config: Record<string, any>;
  nodeKeys: string[];
}

export interface Flow {
  set(key: string, value: any): void;
  get(key: string): any;
  vars: Vars;
  node(id: string, def: NodeDef): Flow;
  run(...ids: readonly string[]): Promise<void>;
  on(fn: FlowListener): () => void;
  use(mod: ModuleDef, overrides?: Record<string, any>): Flow;
  module(id: string): RegisteredModule | undefined;
  modules(): RegisteredModule[];
  configure(moduleId: string, settings: Record<string, any>): void;
  cache(adapter: CacheAdapter): Flow;
  clearCache(): Promise<void>;
}

function hashable(val: any): any {
  if (val instanceof File) return { __file: true, name: val.name, size: val.size, lastModified: val.lastModified };
  if (val instanceof Blob) return { __blob: true, size: val.size, type: val.type };
  return val;
}

async function computeHash(id: string, inputs: Record<string, any>): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify({ id, inputs }));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isSerializable(val: any): boolean {
  if (val == null || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return true;
  if (typeof val === 'function') return false;
  if (val instanceof File || val instanceof Blob || val instanceof Worker) return false;
  if (Array.isArray(val)) return val.every(isSerializable);
  if (typeof val === 'object') return Object.values(val).every(isSerializable);
  return false;
}

function buildNodes(reg: RegisteredModule, nodes: Map<string, NodeDef>) {
  for (const key of reg.nodeKeys) {
    const old = nodes.get(key);
    if (old?.dispose) old.dispose();
    nodes.delete(key);
  }
  reg.nodeKeys = [];
  const built = reg.def.nodes(reg.config);
  for (const [id, def] of Object.entries(built)) {
    nodes.set(id, def);
    reg.nodeKeys.push(id);
  }
}

export function createFlow(opts?: { debug?: boolean }): Flow {
  const debug = opts?.debug ?? (typeof location !== 'undefined' && location.hostname === 'localhost');
  const vars: Vars = {};
  const nodes = new Map<string, NodeDef>();
  const listeners = new Set<FlowListener>();
  const mods = new Map<string, RegisteredModule>();
  let cacheAdapter: CacheAdapter | null = null;

  function emit(event: FlowEvent) {
    for (const fn of listeners) fn(event);
  }

  const flow: Flow = {
    vars,

    set(key, value) { vars[key] = value; emit({ type: 'vars', key, value }); },
    get(key) { return vars[key]; },

    node(id, def) { nodes.set(id, def); return flow; },

    cache(adapter) { cacheAdapter = adapter; return flow; },
    async clearCache() { if (cacheAdapter) await cacheAdapter.clear(); },

    use(mod, overrides?) {
      const reg: RegisteredModule = { def: mod, config: { ...getDefaults(mod), ...overrides }, nodeKeys: [] };
      mods.set(mod.id, reg);
      buildNodes(reg, nodes);
      return flow;
    },

    module(id) { return mods.get(id); },
    modules() { return [...mods.values()]; },

    configure(moduleId, settings) {
      const reg = mods.get(moduleId);
      if (!reg) throw new Error(`Module "${moduleId}" not registered`);
      Object.assign(reg.config, settings);
      buildNodes(reg, nodes);
    },

    async run(...ids) {
      if (debug) console.group(`[flow] run(${ids.join(', ')})`);
      for (const id of ids) {
        const node = nodes.get(id);
        if (!node) {
          if (debug) console.groupEnd();
          throw new Error(`Node "${id}" not found`);
        }

        // cache check
        if (cacheAdapter && node.reads?.length && node.writes?.length) {
          const inputs: Record<string, any> = {};
          for (const key of node.reads) inputs[key] = hashable(vars[key]);
          const cached = await cacheAdapter.get(await computeHash(id, inputs));
          if (cached) {
            if (debug) console.log(`[flow] ⚡ ${id} (cached)`);
            emit({ type: 'node:start', id });
            for (const [key, value] of Object.entries(cached)) { vars[key] = value; emit({ type: 'vars', key, value }); }
            emit({ type: 'node:done', id });
            continue;
          }
        }

        if (debug) console.log(`[flow] ▶ ${id}`);
        emit({ type: 'node:start', id });

        const ctx: FlowContext = {
          get: (key) => vars[key],
          set: (key, value) => {
            vars[key] = value;
            if (debug) console.log(`[flow]   set ${key} =`, typeof value === 'string' ? value.slice(0, 120) : value);
            emit({ type: 'vars', key, value });
          },
          progress: (status, pct) => emit({ type: 'progress', id, status, pct }),
        };

        try {
          await node.run(ctx);

          // cache store
          if (cacheAdapter && node.reads?.length && node.writes?.length) {
            const outputs: Record<string, any> = {};
            let canCache = true;
            for (const key of node.writes) {
              if (!isSerializable(vars[key])) { canCache = false; break; }
              outputs[key] = vars[key];
            }
            if (canCache) {
              const inputs: Record<string, any> = {};
              for (const key of node.reads) inputs[key] = hashable(vars[key]);
              await cacheAdapter.set(await computeHash(id, inputs), outputs);
            }
          }

          if (debug) console.log(`[flow] ✓ ${id}`);
          emit({ type: 'node:done', id });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (debug) { console.error(`[flow] ✕ ${id}:`, err); console.groupEnd(); }
          emit({ type: 'node:error', id, error: msg });
          throw err;
        }
      }
      if (debug) console.groupEnd();
    },

    on(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };

  return flow;
}
