/**
 * Renders the Devpost video from the real app (plan: scripts/video/script.ts).
 *
 *   npx tsx scripts/video/record.ts <page-url> <work-dir> <out.mp4>
 *
 * e.g. npx tsx scripts/video/record.ts http://localhost:5173/ /tmp/rickshaws-video ../video/rickshaws-demo.mp4
 *
 * It speaks each segment with macOS `say`, opens the page in headless Chrome
 * in film mode, drives the night frame by frame at 30 fps, screenshots every
 * frame over the Chrome DevTools Protocol, and joins frames and voice with
 * ffmpeg. Needs macOS, Google Chrome and ffmpeg. No npm packages.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SEGMENTS, type Segment } from './script';

const FPS = 30;
const LEAD = 0.25; // seconds of silence before each voiceover
const VOICE = 'Daniel';
const RATE = '172';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

const [url = 'http://localhost:5173/', workArg = '/tmp/rickshaws-video', outArg = 'rickshaws-demo.mp4'] = process.argv.slice(2);
const work = resolve(workArg);
const out = resolve(outArg);
const frames = join(work, 'frames');
const audio = join(work, 'audio');
rmSync(work, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
mkdirSync(audio, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const duration = (file: string): number =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

// ------------------------------------------------------------------ voice

interface Timed {
  seg: Segment;
  voice: number;
  total: number;
  frames: number;
}
const timed: Timed[] = SEGMENTS.map((seg, i) => {
  const aiff = join(audio, `${String(i).padStart(2, '0')}.aiff`);
  execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', aiff, seg.say]);
  const voice = duration(aiff);
  const total = LEAD + voice + (seg.hold ?? 0.5);
  return { seg, voice, total, frames: Math.round(total * FPS) };
});
const runtime = timed.reduce((s, t) => s + t.frames, 0) / FPS;
console.log(`Voiceover done: ${timed.length} segments, ${runtime.toFixed(1)} s.`);

// Each segment's audio, padded to exactly its frame count, then joined.
const list: string[] = [];
timed.forEach((t, i) => {
  const src = join(audio, `${String(i).padStart(2, '0')}.aiff`);
  const wav = join(audio, `${String(i).padStart(2, '0')}.wav`);
  const len = (t.frames / FPS).toFixed(4);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-af', `adelay=${LEAD * 1000}|${LEAD * 1000},apad`, '-t', len, '-ar', '48000', '-ac', '2', wav]);
  list.push(`file '${wav}'`);
});
writeFileSync(join(audio, 'list.txt'), list.join('\n'));
const voiceTrack = join(work, 'voice.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(audio, 'list.txt'), '-c', 'copy', voiceTrack]);

// ------------------------------------------------------------------ Chrome

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(work, 'chrome')}`,
    '--window-size=1920,1080',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let ws: WebSocket;
let nextId = 1;
const pending = new Map<number, (v: any) => void>();
function send(method: string, params: Record<string, unknown> = {}): Promise<any> {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => {
    pending.set(id, (msg) => (msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result)));
  });
}
async function js(expression: string): Promise<any> {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`${expression}: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
  return r.result.value;
}

async function connect(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
      const page = targets.find((t) => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((r, j) => {
          ws.onopen = r;
          ws.onerror = j;
        });
        ws.onmessage = (e) => {
          const msg = JSON.parse(String(e.data));
          if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)!(msg);
            pending.delete(msg.id);
          }
        };
        return;
      }
    } catch {
      // Chrome is still starting.
    }
    await sleep(200);
  }
  throw new Error('Could not reach headless Chrome');
}

/** Splits a voiceover into subtitle lines with start times, by length. */
function subtitles(text: string, voice: number): { t: number; text: string }[] {
  const parts = text.match(/[^.!?:]+[.!?:]+/g)?.map((s) => s.trim()) ?? [text];
  const total = parts.reduce((s, p) => s + p.length, 0);
  let t = LEAD;
  return parts.map((p) => {
    const line = { t, text: p };
    t += (p.length / total) * voice;
    return line;
  });
}

async function main(): Promise<void> {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const page = url + (url.includes('?') ? '&' : '?') + 'film';
  await send('Page.navigate', { url: page });
  for (let i = 0; i < 100; i++) {
    if (await js('typeof window.rickshawsFilm === "object" && document.fonts.status === "loaded"').catch(() => false)) break;
    await sleep(200);
  }
  await sleep(800);
  await js('rickshawsFilm.reason("shutdown")');

  let n = 0;
  for (const t of timed) {
    const { seg } = t;
    if (seg.card !== undefined) await js(`rickshawsFilm.card(${JSON.stringify(seg.card)})`);
    if (seg.scene) await js(`rickshawsFilm.goTo(${JSON.stringify(seg.scene)})`);
    const lines = subtitles(seg.say, t.voice);
    const actions = [...(seg.at ?? [])];
    if (seg.endTick !== undefined) {
      const start = (await js('rickshawsFilm.state().tick')) as number;
      const speed = Math.max(0, (seg.endTick - start) / (t.frames / FPS));
      await js(`rickshawsFilm.speed(${speed}); rickshawsFilm.pause(false)`);
    } else {
      await js('rickshawsFilm.pause(true)');
    }
    let shown = '';
    for (let f = 0; f < t.frames; f++) {
      const sec = f / FPS;
      while (actions.length && actions[0]!.t <= sec) await js(actions.shift()!.js);
      const line = [...lines].reverse().find((l) => l.t <= sec)?.text ?? '';
      const sub = sec > LEAD + t.voice + 0.15 ? '' : line;
      if (sub !== shown) {
        await js(`rickshawsFilm.sub(${JSON.stringify(sub || null)})`);
        shown = sub;
      }
      await js(`rickshawsFilm.frame(${1000 / FPS})`);
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
      writeFileSync(join(frames, `${String(n++).padStart(6, '0')}.jpg`), Buffer.from(shot.data, 'base64'));
    }
    const state = await js('rickshawsFilm.state()');
    console.log(`${seg.id}: ${t.frames} frames, ends at tick ${state.tick}, bursts per map ${JSON.stringify(state.bursts)}`);
  }
  ws.close();
  chrome.kill();

  execFileSync(
    'ffmpeg',
    [
      '-v', 'error', '-y',
      '-framerate', String(FPS), '-i', join(frames, '%06d.jpg'),
      '-i', voiceTrack,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k',
      '-movflags', '+faststart', '-shortest',
      out,
    ],
    { stdio: 'inherit' },
  );
  console.log(`Wrote ${out} (${runtime.toFixed(1)} s, ${n} frames).`);
}

main().catch((e) => {
  console.error(e);
  chrome.kill();
  process.exit(1);
});
