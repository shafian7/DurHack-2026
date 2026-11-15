// V02: the emergence invariants E1 to E3 for every lane B policy.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ChargerPolicy } from '../../src/contracts';
import { createRng } from '../../src/sim';
import { naivePolicy } from '../../src/policies/naive';
import { staggerPolicy } from '../../src/policies/stagger';
import { localPolicy } from '../../src/policies/local';
import { obs, sagged } from './helpers';

const files = ['naive', 'stagger', 'local'];
const source = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../src/policies/${name}.ts`, import.meta.url)), 'utf8');
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('V02 static checks', () => {
  for (const name of files) {
    it(`${name}.ts imports only from ../contracts`, () => {
      const imports = [...code(source(name)).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      expect(imports.length).toBeGreaterThan(0);
      for (const target of imports) expect(target).toBe('../contracts');
      expect(code(source(name))).not.toMatch(/\bimport\s*\(|\brequire\s*\(/);
    });

    it(`${name}.ts has no Math.random, Date or performance clock`, () => {
      const text = code(source(name));
      expect(text).not.toMatch(/Math\.random/);
      expect(text).not.toMatch(/\bDate\b/);
      expect(text).not.toMatch(/performance\.now/);
    });

    it(`${name}.ts has no mutable module-level state`, () => {
      const text = code(source(name));
      expect(text).not.toMatch(/^(export\s+)?(let|var)\s/m);
      expect(text).not.toMatch(/^(export\s+)?const\s+\w+(\s*:[^=]+)?=\s*(new\s+(Map|Set|Array|WeakMap)|\[)/m);
    });
  }
});

const policies: [string, ChargerPolicy][] = [
  ['naive', naivePolicy as ChargerPolicy],
  ['stagger', staggerPolicy as ChargerPolicy],
  ['local', localPolicy as ChargerPolicy],
];

describe('V02 run-time checks', () => {
  for (const [name, policy] of policies) {
    it(`${name} decides on frozen observations`, () => {
      const rng = createRng(1);
      const memory = policy.createMemory(rng);
      policy.onEvent?.(Object.freeze({ kind: 'pluggedIn', soc: 0.3 }), memory, rng);
      for (let t = 0; t < 300; t++) {
        const o = obs({ pluggedTicks: t, drawing: t % 2 === 0, voltage: t % 7 === 0 ? sagged(0.12) : 229 });
        expect(['on', 'off']).toContain(policy.decide(o, memory, rng));
      }
    });

    it(`${name}: one charger's memory never affects another's`, () => {
      // Run charger A alone, then A alongside B with B fed very different
      // readings, giving each its own rng so only memory could leak.
      const runA = (withB: boolean): string[] => {
        const rngA = createRng(7);
        const rngB = createRng(8);
        const a = policy.createMemory(rngA);
        const b = withB ? policy.createMemory(rngB) : null;
        policy.onEvent?.({ kind: 'pluggedIn', soc: 0.2 }, a, rngA);
        if (b !== null) policy.onEvent?.({ kind: 'pluggedIn', soc: 0.9 }, b, rngB);
        const out: string[] = [];
        let drawing = false;
        for (let t = 0; t < 400; t++) {
          if (b !== null) policy.decide(obs({ voltage: 0, soc: 0.9, pluggedTicks: t }), b, rngB);
          const d = policy.decide(obs({ voltage: t % 50 < 10 ? sagged(0.1) : 228, soc: 0.2, drawing, pluggedTicks: t }), a, rngA);
          drawing = d === 'on';
          out.push(d);
        }
        return out;
      };
      expect(runA(true)).toEqual(runA(false));
    });
  }
});
