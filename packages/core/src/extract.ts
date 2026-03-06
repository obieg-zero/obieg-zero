import type { NodeDef } from './flow.js';

export function extractNode(config?: { output?: string }): NodeDef {
  const output = config?.output ?? 'extracted';
  return {
    async run(ctx) {
      const answer: string = ctx.get('answer');
      if (!answer) throw new Error('extract: needs $answer');

      ctx.set('extractError', null);

      const jsonMatch = answer.match(/\{[\s\S]*\}/) ?? answer.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        ctx.set('extractError', 'Nie znaleziono JSON w odpowiedzi');
        ctx.set(output, null);
        return;
      }

      try {
        ctx.set(output, JSON.parse(jsonMatch[0]));
      } catch {
        ctx.set('extractError', 'Błąd parsowania JSON');
        ctx.set(output, null);
      }
    },
  };
}
