import type { NodeDef } from './flow.js';

export function extractNode(config?: { output?: string }): NodeDef {
  const output = config?.output ?? 'extracted';
  return {
    async run(ctx) {
      const answer: string = ctx.get('answer');
      if (!answer) throw new Error('extract: needs $answer');

      ctx.set('extractError', null);
      const start = answer.search(/[{\[]/);
      if (start === -1) { ctx.set('extractError', 'No JSON found in answer'); ctx.set(output, null); return; }

      let parsed: any = null;
      for (let i = answer.length; i > start; i--) {
        try { parsed = JSON.parse(answer.slice(start, i)); break; } catch {}
      }

      ctx.set(output, parsed);
      if (parsed === null) ctx.set('extractError', 'Failed to parse JSON');
    },
  };
}
