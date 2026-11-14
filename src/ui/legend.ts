/**
 * Legends for the chart and the street view (BUILD B43). Each entry shows the
 * same shape, dash and colour that the canvas draws, as inline SVG.
 */
import type { FleetMode } from '../contracts';
import { el } from './dom';
import { COLOURS, MODE_STYLE, STATE_ORDER, STATE_STYLE, type MarkerShape, type StateStyle } from './theme';

const SVG = 'http://www.w3.org/2000/svg';

function svg(doc: Document, w: number, h: number, children: SVGElement[]): SVGSVGElement {
  const node = doc.createElementNS(SVG, 'svg');
  node.setAttribute('width', String(w));
  node.setAttribute('height', String(h));
  node.setAttribute('viewBox', `0 0 ${w} ${h}`);
  node.setAttribute('aria-hidden', 'true');
  node.classList.add('rk-key-icon');
  for (const c of children) node.append(c);
  return node;
}

function shape(doc: Document, tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = doc.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function marker(doc: Document, kind: MarkerShape, cx: number, cy: number, r: number, fill: string): SVGElement {
  const stroke = { stroke: COLOURS.bg, 'stroke-width': 2, fill };
  switch (kind) {
    case 'square':
      return shape(doc, 'rect', { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, ...stroke });
    case 'circle':
      return shape(doc, 'circle', { cx, cy, r, ...stroke });
    case 'triangle':
      return shape(doc, 'polygon', { points: `${cx},${cy - r * 1.2} ${cx + r * 1.15},${cy + r * 0.85} ${cx - r * 1.15},${cy + r * 0.85}`, ...stroke });
    case 'diamond':
      return shape(doc, 'polygon', { points: `${cx},${cy - r * 1.3} ${cx + r * 1.1},${cy} ${cx},${cy + r * 1.3} ${cx - r * 1.1},${cy}`, ...stroke });
  }
}

function stateIcon(doc: Document, s: StateStyle): SVGElement {
  const c = 9;
  switch (s.shape) {
    case 'dot':
      return shape(doc, 'circle', { cx: c, cy: c, r: 2.5, fill: s.colour });
    case 'hollowSquare':
      return shape(doc, 'rect', { x: 3.5, y: 3.5, width: 11, height: 11, fill: 'none', stroke: s.colour, 'stroke-width': 2.5 });
    case 'triangle':
      return shape(doc, 'polygon', { points: '9,2 16,15 2,15', fill: s.colour });
    case 'disc':
      return shape(doc, 'circle', { cx: c, cy: c, r: 6.5, fill: s.colour });
    case 'cross':
      return shape(doc, 'path', { d: 'M3,3 L15,15 M15,3 L3,15', stroke: s.colour, 'stroke-width': 2.5 });
  }
}

function item(doc: Document, icon: SVGElement, label: string, key: string): HTMLElement {
  return el(doc, 'span', { class: 'rk-key', role: 'listitem', 'data-key': key }, [icon, el(doc, 'span', { text: label })]);
}

/** What each line, band and strip on the chart means. */
export function createChartLegend(doc: Document, modes: readonly FleetMode[]): HTMLElement {
  const items = modes.map((mode) => {
    const st = MODE_STYLE[mode];
    const line = shape(doc, 'line', {
      x1: 2,
      y1: 10,
      x2: 46,
      y2: 10,
      stroke: st.colour,
      'stroke-width': st.width,
      'stroke-dasharray': st.dash.length ? st.dash.map((d) => d * 0.6).join(' ') : 'none',
    });
    return item(doc, svg(doc, 48, 20, [line, marker(doc, st.marker, 24, 10, 6, st.colour)]), st.short, mode);
  });
  items.push(
    item(doc, svg(doc, 48, 20, [shape(doc, 'line', { x1: 2, y1: 10, x2: 46, y2: 10, stroke: COLOURS.rating, 'stroke-width': 2.5 })]), 'Transformer rating', 'rating'),
    item(doc, svg(doc, 30, 20, [shape(doc, 'rect', { x: 1, y: 4, width: 28, height: 14, fill: '#4b5464' })]), 'Household demand', 'household'),
    item(
      doc,
      svg(doc, 30, 20, [
        shape(doc, 'rect', { x: 1, y: 4, width: 28, height: 12, fill: COLOURS.outage }),
        shape(doc, 'path', { d: 'M1,16 L13,4 M9,16 L21,4 M17,16 L29,4', stroke: COLOURS.bg, 'stroke-width': 2 }),
      ]),
      'Power out',
      'outage',
    ),
  );
  return el(doc, 'div', { class: 'rk-legend', role: 'list', 'aria-label': 'Chart legend' }, items);
}

/** What each mark on the street means. */
export function createStreetLegend(doc: Document): HTMLElement {
  const items = STATE_ORDER.map((state) => item(doc, svg(doc, 18, 18, [stateIcon(doc, STATE_STYLE[state])]), STATE_STYLE[state].label, state));
  items.push(
    item(doc, svg(doc, 18, 18, [shape(doc, 'circle', { cx: 9, cy: 9, r: 7, fill: 'none', stroke: '#ff4d6d', 'stroke-width': 1.8 })]), 'Stubborn (ring)', 'stubborn'),
  );
  return el(doc, 'div', { class: 'rk-legend rk-street-legend', role: 'list', 'aria-label': 'Street legend' }, [
    el(doc, 'span', { class: 'rk-legend-title', text: 'On each street, one mark per charger:' }),
    ...items,
  ]);
}
