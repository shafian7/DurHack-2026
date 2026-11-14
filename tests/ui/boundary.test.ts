// V08, static half: nothing under src/ui/ imports from src/sim/, src/policies/ or src/scenarios/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = resolve(__dirname, '..', '..');
const uiDir = join(repo, 'src', 'ui');
const forbidden = ['sim', 'policies', 'scenarios'].map((d) => join(repo, 'src', d));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|js|mjs|html)$/.test(name) ? [p] : [];
  });
}

function specifiers(source: string): string[] {
  const out: string[] = [];
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
    /\bimport\.meta\.glob\s*\(\s*['"]([^'"]+)['"]/g,
    /\bsrc\s*=\s*['"]([^'"]+)['"]/g,
  ];
  for (const re of patterns) for (const m of source.matchAll(re)) out.push(m[1]!);
  return out;
}

describe('V08: the UI reads only the contract', () => {
  const files = walk(uiDir);

  it('finds the UI source files', () => {
    expect(files.some((f) => f.endsWith(join('ui', 'index.ts')))).toBe(true);
    expect(files.some((f) => f.endsWith(join('ui', 'dev', 'fakeSimulation.ts')))).toBe(true);
  });

  it('has no import that reaches src/sim, src/policies or src/scenarios', () => {
    const offences: string[] = [];
    for (const file of files) {
      for (const spec of specifiers(readFileSync(file, 'utf8'))) {
        const target = spec.startsWith('.') ? resolve(dirname(file), spec) : spec.startsWith('/') ? join(repo, spec) : null;
        if (target && forbidden.some((f) => target === f || target.startsWith(f + sep))) {
          offences.push(`${relative(repo, file)} -> ${spec}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  it('uses no Math.random outside the dev stand-in', () => {
    const offenders = files.filter((f) => !f.includes(`${sep}dev${sep}`) && readFileSync(f, 'utf8').includes('Math.random'));
    expect(offenders.map((f) => relative(repo, f))).toEqual([]);
  });
});
