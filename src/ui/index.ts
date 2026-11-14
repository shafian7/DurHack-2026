import type { MountApp } from '../contracts';
import { createApp } from './app';

/** Called by src/main.ts with the real modules (CONTRACTS §9). */
export const mountApp: MountApp = (root, deps) => {
  createApp(root, deps, { autoStart: true });
};
