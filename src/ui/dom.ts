type Attrs = Record<string, string | number | boolean | undefined>;

/** Small element builder. Attributes starting with "data-" or "aria-" are set as attributes, the rest as properties. */
export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Attrs = {},
  children: ReadonlyArray<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

/** Sets text only when it changes, so steady values cost nothing per frame. */
export function setText(node: Element, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}
