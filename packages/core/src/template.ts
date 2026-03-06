import type { NodeDef } from './flow.js';

export function templateNode(config: { template: string; output?: string }): NodeDef {
  const { template, output = 'prompt' } = config;
  return {
    async run(ctx) {
      const result = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const val = ctx.get(key);
        return val != null ? String(val) : '';
      });
      ctx.set(output, result);
    },
  };
}
