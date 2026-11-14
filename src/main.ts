// Wiring only. Lane A connects the simulation core, policies, scenarios and UI
// here as each lands on main (BUILD B04). Until then there is nothing to mount.
import { defaultConfig } from './sim';

const root = typeof document === 'undefined' ? null : document.getElementById('app');
if (root) {
  const { gridWidth, gridHeight } = defaultConfig();
  root.textContent = `RICKSHAWS scaffold: ${gridWidth} by ${gridHeight} grid configured. The simulation and interface have not landed yet.`;
}
