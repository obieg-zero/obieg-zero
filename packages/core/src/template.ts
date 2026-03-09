import type { NodeDef } from './flow.js';

export function templateNode(config: { template: string; output?: string }): NodeDef {
  const { template, output = 'prompt' } = config;
  const reads = [...template.matchAll(/\{\{([\w:.]+)\}\}/g)].map(m => m[1]);
  return {
    reads,
    writes: [output],
    async run(ctx) {
      const result = template.replace(/\{\{([\w:.]+)\}\}/g, (_, key) => {
        const val = ctx.get(key);
        if (val == null) throw new Error(`template: missing variable {{${key}}}`);
        return String(val);
      });
      ctx.set(output, result);
    },
  };
}
