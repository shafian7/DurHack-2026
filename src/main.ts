// Wiring only. Lane A connects the simulation core, policies, scenarios and UI
// here as each lands on build (BUILD B04). Until then there is nothing to mount.
import { defaultConfig } from './sim';

const root = typeof document === 'undefined' ? null : document.getElementById('app');
if (root) {
  root.textContent = `RICKSHAWS scaffold: ${defaultConfig().fleetSize} chargers configured. The simulation and interface have not landed yet.`;
}
