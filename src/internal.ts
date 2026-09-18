import { injectedScriptFor } from "./injected";

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
