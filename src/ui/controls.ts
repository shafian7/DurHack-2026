/**
 * Judge controls (BUILD B42, CONTRACTS §7). Each button carries
 * data-cmd="<Command kind>" and, where the command takes a value,
 * data-value. The app sends the command to every neighbourhood at once.
 */
import type { Command } from '../contracts';
import { el } from './dom';
import { durationText } from './time';

export type CommandKind = Command['kind'];

export interface CommandControl {
  readonly kind: CommandKind;
  readonly value?: number;
  /** Button text. */
  readonly label: string;
  /** One line explaining it, shown as a tooltip. */
  readonly hint: string;
}

export interface ControlGroup {
  readonly title: string;
  readonly controls: readonly CommandControl[];
}

/** Every command kind appears at least once. The values are demo settings, not results. */
export const CONTROL_GROUPS: readonly ControlGroup[] = [
  {
    title: 'Household demand',
    controls: [
      { kind: 'setBaseLoadScale', value: 1.3, label: 'Heatwave ×1.3', hint: 'Households draw 30% more from now on' },
      { kind: 'setBaseLoadScale', value: 1, label: 'Normal', hint: 'Household demand back to normal' },
    ],
  },
  {
    title: 'Transformer',
    controls: [
      { kind: 'setRatingScale', value: 0.8, label: 'Derate to 80%', hint: 'The transformer can carry only 80% of its rating' },
      { kind: 'setRatingScale', value: 1, label: 'Full rating', hint: 'Back to the full rating' },
    ],
  },
  {
    title: 'Grid voltage',
    controls: [
      { kind: 'setSupplyVoltage', value: 0.95, label: 'Sag to 95%', hint: 'The whole grid sags; not this street’s doing' },
      { kind: 'setSupplyVoltage', value: 1, label: 'Normal', hint: 'Supply voltage back to normal' },
    ],
  },
  {
    title: 'Break things',
    controls: [
      { kind: 'powerCut', value: 60, label: 'Cut power 1 h', hint: 'Load-shedding: no power for an hour, then all at once' },
      { kind: 'plugInBurst', value: 50, label: '50 home early', hint: 'Up to 50 rickshaws that are away come home and plug in now' },
      { kind: 'stubbornChargers', value: 0.2, label: 'Make 20% stubborn', hint: 'A fifth of chargers ignore their rule and charge whenever plugged in' },
      { kind: 'removeChargers', value: 0.1, label: 'Remove 10%', hint: 'A tenth of the chargers disappear for good' },
    ],
  },
  {
    title: 'Central scheduler',
    controls: [
      { kind: 'killScheduler', label: 'Kill server', hint: 'The scheduler stops; its chargers fall back to plain charging' },
      { kind: 'reviveScheduler', label: 'Revive', hint: 'The scheduler resumes planning' },
    ],
  },
];

/** Builds the Command for a control. Returns null for an unknown kind or a bad value. */
export function commandFor(kind: string, value?: number): Command | null {
  const v = value ?? NaN;
  switch (kind) {
    case 'setBaseLoadScale':
      return Number.isFinite(v) ? { kind, scale: v } : null;
    case 'setRatingScale':
      return Number.isFinite(v) ? { kind, scale: v } : null;
    case 'setSupplyVoltage':
      return Number.isFinite(v) ? { kind, perUnit: v } : null;
    case 'powerCut':
      return Number.isFinite(v) ? { kind, ticks: v } : null;
    case 'plugInBurst':
      return Number.isFinite(v) ? { kind, count: v } : null;
    case 'removeChargers':
      return Number.isFinite(v) ? { kind, fraction: v } : null;
    case 'stubbornChargers':
      return Number.isFinite(v) ? { kind, fraction: v } : null;
    case 'killScheduler':
    case 'reviveScheduler':
      return { kind };
    default:
      return null;
  }
}

const pctOf = (v: number) => `${Math.round(v * 100)}%`;

/** Short text for the chart's action markers. */
export function commandLabel(cmd: Command): string {
  switch (cmd.kind) {
    case 'setBaseLoadScale':
      return cmd.scale === 1 ? 'Demand normal' : `Heatwave ×${cmd.scale}`;
    case 'setRatingScale':
      return cmd.scale === 1 ? 'Full rating' : `Derated ${pctOf(cmd.scale)}`;
    case 'setSupplyVoltage':
      return cmd.perUnit === 1 ? 'Voltage normal' : `Grid ${pctOf(cmd.perUnit)}`;
    case 'powerCut':
      return `Power cut ${durationText(cmd.ticks)}`;
    case 'plugInBurst':
      return `${cmd.count} home early`;
    case 'removeChargers':
      return `${pctOf(cmd.fraction)} removed`;
    case 'stubbornChargers':
      return `${pctOf(cmd.fraction)} stubborn`;
    case 'killScheduler':
      return 'Server killed';
    case 'reviveScheduler':
      return 'Server revived';
  }
}

/** The judge panel. onCommand receives the command each button stands for. */
export function createCommandPanel(doc: Document, onCommand: (cmd: Command, button: HTMLButtonElement) => void): HTMLElement {
  const panel = el(doc, 'aside', { class: 'rk-judge', 'aria-label': 'Judge controls' }, [
    el(doc, 'h2', { text: 'Break it' }),
    el(doc, 'p', { class: 'rk-judge-note', text: 'Every action hits all three neighbourhoods at the same moment.' }),
  ]);
  for (const group of CONTROL_GROUPS) {
    const row = el(doc, 'div', { class: 'rk-btnrow' });
    for (const c of group.controls) {
      const btn = el(doc, 'button', {
        type: 'button',
        class: 'rk-btn rk-cmd',
        'data-cmd': c.kind,
        'data-value': c.value,
        title: c.hint,
        text: c.label,
      });
      btn.addEventListener('click', () => {
        const cmd = commandFor(c.kind, c.value);
        if (cmd) onCommand(cmd, btn);
      });
      row.append(btn);
    }
    panel.append(el(doc, 'div', { class: 'rk-group' }, [el(doc, 'h3', { text: group.title }), row]));
  }
  return panel;
}
