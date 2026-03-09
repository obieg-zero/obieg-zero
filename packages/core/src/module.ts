import type { NodeDef } from './flow.js';

export interface SettingDef {
  type: 'string' | 'number' | 'boolean';
  label: string;
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

export function getDefaults(_mod: ModuleDef): Record<string, any> {
  return {};
}
