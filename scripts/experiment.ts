/**
 * npm run experiment [-- --seeds 1-10] [--out docs/RESULTS.md] [--no-resilience] [--no-district]
 *
 * Runs the standard experiment (VALIDATION §2), judges the claim clause by
 * clause, runs the B24 resilience variants, and writes docs/RESULTS.md.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { buildReport } from './report';

function parseSeeds(text: string): number[] {
  const range = /^(\d+)-(\d+)$/.exec(text);
  if (range) {
    const [lo, hi] = [Number(range[1]), Number(range[2])];
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }
  return text.split(',').map(Number);
}

function currentCommit(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain -- src scripts', { encoding: 'utf8' }).trim() !== '';
    return dirty ? `${sha} with uncommitted changes in src/ or scripts/` : sha;
  } catch {
    return 'unknown';
  }
}

const args = process.argv.slice(2);
const value = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const seeds = parseSeeds(value('--seeds') ?? '1-10');
const out = value('--out') ?? 'docs/RESULTS.md';
const report = buildReport({ commit: currentCommit(), seeds, resilience: !args.includes('--no-resilience'),
  district: !args.includes('--no-district'),
});
writeFileSync(out, report);
console.log(`Wrote ${out} (${seeds.length} seeds).`);
