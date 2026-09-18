import type { Page } from "@playwright/test";
import { asLocator } from "virtual:playwright-lite-injected";
import { Error, ShadowRoot, TypeError } from "virtual:playwright-lite-globals";
import { injectedScriptFor } from "./injected";
import { PageImpl } from "./page";

// Fork-only contract for the WebMCP integration. Not part of upstream's root API.
export { isPlaywrightLiteLocator, resolveLocatorElements } from "./locator";

export type CaptureAriaSnapshotResult = {
  distilledText: string;
  fullText: string;
  refsByElement: Map<Element, string>;
};

export function captureAriaSnapshot(root: Element): CaptureAriaSnapshotResult {
  return injectedScriptFor(root).captureAriaSnapshot(root);
}

/**
 * The locator Playwright's codegen writes for `element`, as pinned recorder.ts
 * asks the pinned InjectedScript's generateSelector for it, using the page's
 * test ID attribute. With `root`, the locator is relative to `root`.
 */
export function generateLocator(
  page: Page,
  element: Element,
  options: { root?: Element } = {}
): string {
  if (!(page instanceof PageImpl))
    throw new TypeError("generateLocator: expected a playwright-lite Page.");
  const { selector, elements } = injectedScriptFor(
    element,
    page.testIdAttribute
  ).generateSelector(element, {
    testIdAttributeName: page.testIdAttribute,
    root: options.root,
  });
  const locator = asLocator("javascript", selector);
  // The generator may address the element's interactive ancestor instead.
  const [match] = elements;
  if (elements.length !== 1 || !isSelfOrAncestor(match, element))
    throw new Error(
      `generateLocator: ${locator} does not resolve to exactly the element (${elements.length} matches).`
    );
  return locator;
}

function isSelfOrAncestor(candidate: Element, element: Element): boolean {
  for (let node: Element | null = element; node;) {
    if (node === candidate) return true;
    const root = node.getRootNode();
    node =
      node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return false;
}
