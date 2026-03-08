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
      // try from each closing bracket/brace, not char-by-char
      const closer = answer[start] === '{' ? '}' : ']';
      for (let i = answer.lastIndexOf(closer); i > start; i = answer.lastIndexOf(closer, i - 1)) {
        try { parsed = JSON.parse(answer.slice(start, i + 1)); break; } catch {}
      }

      ctx.set(output, parsed);
      if (parsed === null) ctx.set('extractError', 'Failed to parse JSON');
    },
  };
}
