import type { NodeDef } from './flow.js';

export interface SettingDef {
  type: 'string' | 'number' | 'boolean';
  label: string;
  default: string | number | boolean;
}

export interface ModuleDef {
  id: string;
  label: string;
  settings: Record<string, SettingDef>;
  nodes: (config: Record<string, any>) => Record<string, NodeDef>;
}

export function defineModule(def: ModuleDef): ModuleDef {
  return def;
}

export function getDefaults(mod: ModuleDef): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, s] of Object.entries(mod.settings)) {
    out[key] = s.default;
  }
  return out;
}
