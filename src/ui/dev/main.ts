/**
 * Development page: the interface driven by the fake simulation, so it can be
 * built and checked without the real core. Open /src/ui/dev/index.html under
 * `npm run dev`. Not part of the production build.
 *
 * ?skip=N steps every neighbourhood N ticks before the first frame, so a
 * screenshot can show the evening without waiting.
 */
import { createApp } from '../app';
import { devScenarios } from './scenarios';
import { createFakeSimulation, fakeConfig } from './fakeSimulation';

const root = document.getElementById('app');
if (root) {
  const app = createApp(
    root,
    {
      makeSimulation: (mode, config) => createFakeSimulation(config, mode),
      defaultConfig: fakeConfig(),
      scenarios: devScenarios,
    },
    { autoStart: true },
  );
  const skip = Number(new URLSearchParams(location.search).get('skip') ?? 0);
  if (skip > 0) app.advance(Math.min(skip, 20000));
}
