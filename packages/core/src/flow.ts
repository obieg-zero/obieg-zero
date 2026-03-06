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

export interface Flow {
  set(key: string, value: any): void;
  get(key: string): any;
  vars: Vars;
  node(id: string, def: NodeDef): Flow;
  run(...ids: string[]): Promise<void>;
  on(fn: FlowListener): () => void;
}

export function createFlow(): Flow {
  const vars: Vars = {};
  const nodes = new Map<string, NodeDef>();
  const listeners = new Set<FlowListener>();

  function emit(event: FlowEvent) {
    for (const fn of listeners) fn(event);
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
