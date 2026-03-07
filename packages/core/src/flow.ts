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
}

export type FlowEvent =
  | { type: 'vars'; key: string; value: any }
  | { type: 'node:start'; id: string }
  | { type: 'node:done'; id: string }
  | { type: 'node:error'; id: string; error: string }
  | { type: 'progress'; id: string; status: string; pct?: number };

export type FlowListener = (event: FlowEvent) => void;

export interface EachConfig {
  id?: string;
  items: any[];
  set: Record<string, (item: any, index: number) => any>;
  run: readonly string[];
  collect?: string;
}

export interface RegisteredModule {
  def: ModuleDef;
  config: Record<string, any>;
  enabled: boolean;
  nodeKeys: string[];
}

export interface Flow {
  set(key: string, value: any): void;
  get(key: string): any;
  vars: Vars;
  node(id: string, def: NodeDef): Flow;
  run(...ids: readonly string[]): Promise<void>;
  each(config: EachConfig): Promise<any[]>;
  on(fn: FlowListener): () => void;
  use(mod: ModuleDef, overrides?: Record<string, any>): Flow;
  module(id: string): RegisteredModule | undefined;
  modules(): RegisteredModule[];
  configure(moduleId: string, settings: Record<string, any>): void;
  enable(moduleId: string): void;
  disable(moduleId: string): void;
}

export function createFlow(opts?: { debug?: boolean }): Flow {
  const debug = opts?.debug ?? (typeof location !== 'undefined' && location.hostname === 'localhost');
  const vars: Vars = {};
  const nodes = new Map<string, NodeDef>();
  const listeners = new Set<FlowListener>();
  const registeredModules = new Map<string, RegisteredModule>();

  function emit(event: FlowEvent) {
    for (const fn of listeners) fn(event);
  }

  function rebuildNodes(reg: RegisteredModule) {
    // dispose old nodes tracked by this module
    for (const key of reg.nodeKeys) {
      const old = nodes.get(key);
      if (old?.dispose) old.dispose();
      nodes.delete(key);
    }
    reg.nodeKeys = [];
    if (!reg.enabled) return;
    // build new nodes
    const built = reg.def.nodes(reg.config);
    for (const [id, def] of Object.entries(built)) {
      nodes.set(id, def);
      reg.nodeKeys.push(id);
    }
  }

  const flow: Flow = {
    vars,

    set(key: string, value: any) {
      vars[key] = value;
      emit({ type: 'vars', key, value });
    },

    get(key: string) {
      return vars[key];
    },

    node(id: string, def: NodeDef) {
      nodes.set(id, def);
      return flow;
    },

    use(mod: ModuleDef, overrides?: Record<string, any>) {
      const config = { ...getDefaults(mod), ...overrides };
      const reg: RegisteredModule = { def: mod, config, enabled: true, nodeKeys: [] };
      registeredModules.set(mod.id, reg);
      rebuildNodes(reg);
      return flow;
    },

    module(id: string) {
      return registeredModules.get(id);
    },

    modules() {
      return [...registeredModules.values()];
    },

    configure(moduleId: string, settings: Record<string, any>) {
      const reg = registeredModules.get(moduleId);
      if (!reg) throw new Error(`Module "${moduleId}" not registered`);
      Object.assign(reg.config, settings);
      if (reg.enabled) rebuildNodes(reg);
    },

    enable(moduleId: string) {
      const reg = registeredModules.get(moduleId);
      if (!reg) throw new Error(`Module "${moduleId}" not registered`);
      reg.enabled = true;
      rebuildNodes(reg);
    },

    disable(moduleId: string) {
      const reg = registeredModules.get(moduleId);
      if (!reg) throw new Error(`Module "${moduleId}" not registered`);
      reg.enabled = false;
      rebuildNodes(reg);
    },

    async run(...ids: readonly string[]) {
      if (debug) console.group(`[flow] run(${ids.join(', ')})`);
      for (const id of ids) {
        const node = nodes.get(id);
        if (!node) {
          if (debug) { console.error(`[flow] Node "${id}" not found. Registered: ${[...nodes.keys()].join(', ')}`); console.groupEnd(); }
          throw new Error(`Node "${id}" not found`);
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
          progress: (status, pct) => {
            if (debug) console.log(`[flow]   progress ${id}: ${status}${pct != null ? ` (${pct}%)` : ''}`);
            emit({ type: 'progress', id, status, pct });
          },
        };

        try {
          await node.run(ctx);
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

    async each(config: EachConfig) {
      const { id = 'each', items, set: bindings, run: pipeline, collect } = config;
      const results: any[] = [];

      emit({ type: 'node:start', id });

      for (let i = 0; i < items.length; i++) {
        emit({ type: 'progress', id, status: `${i + 1}/${items.length}`, pct: ((i + 1) / items.length) * 100 });

        for (const [key, fn] of Object.entries(bindings)) {
          flow.set(key, fn(items[i], i));
        }

        await flow.run(...pipeline);

        if (collect) {
          const val = vars[collect];
          if (val != null && typeof val === 'object') results.push({ _index: i, _item: items[i], ...val });
          else if (val != null) results.push(val);
        }
      }

      emit({ type: 'node:done', id });
      return results;
    },

    on(fn: FlowListener) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };

  return flow;
}
