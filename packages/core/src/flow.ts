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

  // Find module config for a node by its base id
  function moduleConfigFor(baseId: string): Record<string, any> {
    for (const [, reg] of mods) {
      if (reg.nodeKeys.includes(baseId)) return reg.config;
    }
    return {};
  }

  const flow: Flow = {
    vars,

    set(key, value) { vars[key] = value; emit({ type: 'vars', key, value }); },
    get(key) { return vars[key]; },

    node(id, def) { nodes.set(id, def); return flow; },

    cache(adapter) { cacheAdapter = adapter; return flow; },
    async clearCache() { if (cacheAdapter) await cacheAdapter.clear(); },

    use(mod, overrides?) {
      const config = { ...getDefaults(mod), ...overrides };
      const built = mod.nodes(config);
      const nodeKeys = Object.keys(built);
      // Dispose old nodes if re-registering
      const old = mods.get(mod.id);
      if (old) for (const key of old.nodeKeys) { nodes.get(key)?.dispose?.(); nodes.delete(key); }
      for (const [id, def] of Object.entries(built)) nodes.set(id, def);
      mods.set(mod.id, { def: mod, config, nodeKeys });
      return flow;
    },

    module(id) { return mods.get(id); },
    modules() { return [...mods.values()]; },

    configure(moduleId, settings) {
      const reg = mods.get(moduleId);
      if (!reg) throw new Error(`Module "${moduleId}" not registered`);
      Object.assign(reg.config, settings);
      // NO rebuild — nodes read config through ctx.get() fallback
    },

    async run(...ids) {
      if (debug) console.group(`[flow] run(${ids.join(', ')})`);
      for (const id of ids) {
        // namespace: 'ocr:umowa' → baseId='ocr', scope='umowa'
        const colonIdx = id.indexOf(':');
        const scope = colonIdx >= 0 ? id.slice(colonIdx + 1) : '';
        const baseId = colonIdx >= 0 ? id.slice(0, colonIdx) : id;
        const node = nodes.get(id) ?? (scope ? nodes.get(baseId) : undefined);
        if (!node) {
          if (debug) console.groupEnd();
          throw new Error(`Node "${id}" not found`);
        }

        const ns = (key: string) => scope ? `${key}:${scope}` : key;
        const modConfig = moduleConfigFor(baseId);

        // build cache key from inputs
        const canCache = cacheAdapter && node.reads?.length && node.writes?.length;
        let cacheKey: string | undefined;
        if (canCache) {
          const inputs: Record<string, any> = {};
          for (const key of node.reads!) inputs[key] = hashable(vars[ns(key)] ?? vars[key]);
          cacheKey = await computeHash(id, inputs);
          const cached = await cacheAdapter!.get(cacheKey);
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
          get: (key) => {
            const nsKey = ns(key);
            // 1. namespaced flow var
            if (nsKey !== key && vars[nsKey] !== undefined) return vars[nsKey];
            // 2. global flow var
            if (vars[key] !== undefined) return vars[key];
            // 3. module config (from task.json via configure / use overrides)
            if (key in modConfig) return modConfig[key];
            return undefined;
          },
          set: (key, value) => {
            const actual = ns(key);
            vars[actual] = value;
            if (debug) console.log(`[flow]   set ${actual} =`, typeof value === 'string' ? value.slice(0, 120) : value);
            emit({ type: 'vars', key: actual, value });
          },
          progress: (status, pct) => emit({ type: 'progress', id, status, pct }),
        };

        try {
          await node.run(ctx);

          // cache store
          if (canCache && cacheKey) {
            const outputs: Record<string, any> = {};
            let store = true;
            for (const key of node.writes!) {
              const actual = ns(key);
              if (!isSerializable(vars[actual])) { store = false; break; }
              outputs[actual] = vars[actual];
            }
            if (store) await cacheAdapter!.set(cacheKey, outputs);
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
