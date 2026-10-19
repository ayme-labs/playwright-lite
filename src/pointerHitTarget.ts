import { inputShadowRoot } from "./closedShadowRoots";

/** Fork-only: what `pointerHitTarget` in `./internal` reports. */
export type PointerHitTarget = {
  /**
   * Where playwright-lite would click: the centre of the first of the
   * element's boxes the viewport shows, as a click without a position uses.
   * Viewport coordinates.
   */
  point: { x: number; y: number };
  /**
   * The element a click at `point` would hit instead, when the click would not
   * reach `element`; absent when it would reach it. The deepest element at the
   * point, through open shadow roots and the closed ones playwright-lite has
   * learned.
   */
  hit?: Element;
};

/**
 * The element a pointer at `point` hits, as pinned InjectedScript's
 * `expectHitTarget(hitPoint, targetElement)` computes it before it decides
 * whether the hit reaches `target`. The pinned method only returns a
 * description of that element, so this mirrors its computation step by step:
 * the enclosing shadow roots of `target` out to the document, then, from the
 * document inwards, `elementsFromPoint` on each root while the hit stays the
 * next root's host, with the same `display: contents` and host-first
 * adjustments. `undefined` when no element is at the point.
 */
export function hitElementAt(
  point: { x: number; y: number },
  target: Element,
  browserWindow: Window
): Element | undefined {
  // Mirrors pinned expectHitTarget: the roots loop.
  const roots: (Document | ShadowRoot)[] = [];
  let parentElement: Element | null = target;
  while (parentElement) {
    const root = enclosingShadowRootOrDocument(parentElement);
    if (!root) break;
    roots.push(root);
    if (root.nodeType === 9) break;
    parentElement = (root as ShadowRoot).host;
  }
  let hitElement: Element | undefined;
  for (let index = roots.length - 1; index >= 0; index--) {
    const innerElement = innermostElementAt(roots[index], point, browserWindow);
    if (!innerElement) break;
    hitElement = innerElement;
    if (index && innerElement !== (roots[index - 1] as ShadowRoot).host) break;
  }
  return hitElement;
}

/**
 * Mirrors pinned expectHitTarget: the first of `root.elementsFromPoint`, with
 * a `display: contents` element the single-element query reports put in front
 * and a shadow host Chromium lists in front of its own tree taken out.
 */
function innermostElementAt(
  root: Document | ShadowRoot,
  point: { x: number; y: number },
  browserWindow: Window
): Element | undefined {
  const elements = root.elementsFromPoint(point.x, point.y);
  const singleElement = root.elementFromPoint(point.x, point.y);
  if (
    singleElement &&
    elements[0] &&
    parentElementOrShadowHost(singleElement) === elements[0]
  ) {
    const style = browserWindow.getComputedStyle(singleElement);
    if (style?.display === "contents") elements.unshift(singleElement);
  }
  if (
    elements[0] &&
    elements[0].shadowRoot === root &&
    elements[1] === singleElement
  )
    elements.shift();
  return elements[0];
}

/**
 * Mirrors pinned expectHitTarget: the hit reaches `target` when walking up
 * from `hit` through `assignedSlot` and parent-or-shadow-host arrives at it.
 */
export function hitReaches(hit: Element | undefined, target: Element): boolean {
  let element: Element | undefined = hit;
  while (element && element !== target)
    element = element.assignedSlot ?? parentElementOrShadowHost(element);
  return element === target;
}

/**
 * The deepest element under `hit` at `point`: pinned expectHitTarget stops at
 * a shadow host whose tree does not enclose the target, which is the element
 * the browser reports to the document. This descends into that host's open
 * root, or its closed root once playwright-lite has learned it, the way input
 * into it would, so the consumer sees the element in the way rather than its
 * host. It never changes the reach decision, which is made before it runs.
 */
export function deepestHitAt(
  hit: Element,
  point: { x: number; y: number },
  browserWindow: Window
): Element {
  for (;;) {
    const root = inputShadowRoot(hit);
    if (!root) return hit;
    const inner = innermostElementAt(root, point, browserWindow);
    // Only an element of this tree is deeper; the browser also lists the
    // host's own ancestors for a shadow root.
    if (!inner || inner === hit || inner.getRootNode() !== root) return hit;
    hit = inner;
  }
}

/** Pinned domUtils.ts `parentElementOrShadowHost`. */
function parentElementOrShadowHost(element: Element): Element | undefined {
  if (element.parentElement) return element.parentElement;
  if (!element.parentNode) return;
  if (
    element.parentNode.nodeType === 11 &&
    (element.parentNode as ShadowRoot).host
  )
    return (element.parentNode as ShadowRoot).host;
}

/** Pinned domUtils.ts `enclosingShadowRootOrDocument`. */
function enclosingShadowRootOrDocument(
  element: Element
): Document | ShadowRoot | undefined {
  let node: Node = element;
  while (node.parentNode) node = node.parentNode;
  if (node.nodeType === 11 || node.nodeType === 9)
    return node as Document | ShadowRoot;
}
