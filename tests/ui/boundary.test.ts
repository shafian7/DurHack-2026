// V08, adapted (plan.md §3.6): the interface reads the simulation only through
// the contracts. It may import the map and the district's types, never the
// core, the policies or the scenarios.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = fileURLToPath(new URL('../../src/ui/', import.meta.url));

describe('UI boundary', () => {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    it(`${file} imports only contracts, the map, district types and its own files`, () => {
      const text = readFileSync(dir + file, 'utf8');
      for (const m of text.matchAll(/^import\s+(type\s+)?[^;]*?from\s+['"]([^'"]+)['"]/gms)) {
        const typeOnly = Boolean(m[1]);
        const target = m[2]!;
        const ok =
          target.startsWith('./') ||
          target === '../contracts' ||
          target === '../map' ||
          (target === '../sim/district' && typeOnly);
        expect(ok, `${file} imports ${target}`).toBe(true);
      }
    });
  }
});
