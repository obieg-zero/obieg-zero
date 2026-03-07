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
  enabled: boolean;
}

export interface Flow {
  set(key: string, value: any): void;
  get(key: string): any;
  vars: Vars;
  node(id: string, def: NodeDef): Flow;
  run(...ids: string[]): Promise<void>;
  on(fn: FlowListener): () => void;
  use(mod: ModuleDef, overrides?: Record<string, any>): Flow;
  module(id: string): RegisteredModule | undefined;
  modules(): RegisteredModule[];
  configure(moduleId: string, settings: Record<string, any>): void;
  enable(moduleId: string): void;
  disable(moduleId: string): void;
}

export function createFlow(): Flow {
  const vars: Vars = {};
  const nodes = new Map<string, NodeDef>();
  const listeners = new Set<FlowListener>();
  const registeredModules = new Map<string, RegisteredModule>();

  function emit(event: FlowEvent) {
    for (const fn of listeners) fn(event);
  }

  function rebuildNodes(reg: RegisteredModule) {
    // remove old nodes from this module
    for (const key of Object.keys(reg.def.nodes(reg.config))) {
      nodes.delete(key);
    }
    if (!reg.enabled) return;
    // add nodes with current config
    const built = reg.def.nodes(reg.config);
    for (const [id, def] of Object.entries(built)) {
      nodes.set(id, def);
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
      const reg: RegisteredModule = { def: mod, config, enabled: true };
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

    async run(...ids: string[]) {
      for (const id of ids) {
        const node = nodes.get(id);
        if (!node) throw new Error(`Node "${id}" not found`);

        emit({ type: 'node:start', id });

        const ctx: FlowContext = {
          get: (key) => vars[key],
          set: (key, value) => {
            vars[key] = value;
            emit({ type: 'vars', key, value });
          },
          progress: (status, pct) => {
            emit({ type: 'progress', id, status, pct });
          },
        };

        try {
          await node.run(ctx);
          emit({ type: 'node:done', id });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          emit({ type: 'node:error', id, error: msg });
          throw err;
        }
      }
    },

    on(fn: FlowListener) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };

  return flow;
}
