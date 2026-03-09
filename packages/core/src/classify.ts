import type { NodeDef } from './flow.js';

export interface ClassifyRule {
  type: string;
  patterns: string[];
  parent?: string;
}

export function classifyNode(config: { rules: ClassifyRule[] }): NodeDef {
  const { rules } = config;
  return {
    reads: ['pages'],
    writes: ['docType', 'docParent'],
    async run(ctx) {
      const pages: { page: number; text: string }[] = ctx.get('pages');
      if (!pages?.length) throw new Error('classify: needs $pages');

      const full = pages.map(p => p.text).join('\n').toLowerCase();

      let best: ClassifyRule | null = null;
      let bestCount = 0;

      for (const rule of rules) {
        const count = rule.patterns.filter(p => full.includes(p.toLowerCase())).length;
        if (count > bestCount) { best = rule; bestCount = count; }
      }

      ctx.set('docType', best?.type ?? 'unknown');
      ctx.set('docParent', best?.parent ?? null);
    },
  };
}
