// Browser entry (plan.md §3.6). Builds the two sides of the comparison on the
// Dhanmondi map: ordinary chargers (naive) and smart chargers (local).
import type { FleetMode } from './contracts';
import { dhanmondi, dhanmondiDistrict } from './map';
import { naivePolicy } from './policies/naive';
import { localPolicy } from './policies/local';
import { staggerPolicy } from './policies/stagger';
import { createScheduler } from './policies/scheduler';
import { createDistrict, DISTRICT_THERMAL } from './sim/district';
import { mountMapApp } from './ui';

function makeDistrict(mode: FleetMode, seed: number) {
  return createDistrict(dhanmondiDistrict(seed), mode, () => {
    switch (mode) {
      case 'naive':
        return { policy: naivePolicy };
      case 'stagger':
        return { policy: staggerPolicy };
      case 'local':
        return { policy: localPolicy };
      case 'central':
        return { scheduler: createScheduler() };
    }
  });
}

const root = document.getElementById('app');
if (root) mountMapApp(root, { map: dhanmondi, makeDistrict, burstC: DISTRICT_THERMAL.burstHotSpotC });
