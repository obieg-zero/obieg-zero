import type { NodeDef } from './flow.js';

export interface SettingDef {
  type: 'string' | 'number' | 'boolean';
  label: string;
  default: string | number | boolean;
}

export interface ModuleDef<S extends Record<string, any> = Record<string, any>> {
  id: string;
  label: string;
  settings: { [K in keyof S]: SettingDef };
  nodes: (config: S) => Record<string, NodeDef>;
}

export function defineModule<S extends Record<string, any>>(def: ModuleDef<S>): ModuleDef<S> {
  return def;
}

export function getDefaults<S extends Record<string, any>>(mod: ModuleDef<S>): S {
  const out: any = {};
  for (const [key, s] of Object.entries(mod.settings)) {
    out[key] = s.default;
  }
  return out as S;
}
