import { afterEach, expect, it } from "vitest";
import { createPage } from "./index";
import {
  captureAriaSnapshot,
  isPlaywrightLiteLocator,
  resolveLocatorElements,
} from "./internal";

afterEach(() => {
  document.body.innerHTML = "";
});

it("keeps full DOM refs and locator identity across dual captures", async () => {
  document.body.innerHTML =
    '<section id="root"><img src="pixel.png"><h2 style="pointer-events:none">Heading</h2><button data-test="save">Save</button><p style="pointer-events:none">Static</p></section>';
  const page = createPage({ testIdAttribute: "data-test" });
  const locator = page.getByTestId("save");
  const button = document.querySelector("button")!;
  expect(isPlaywrightLiteLocator(locator)).toBe(true);
  expect(isPlaywrightLiteLocator({})).toBe(false);
  expect(resolveLocatorElements(locator)).toEqual([button]);
  const before = await page.ariaSnapshot();
  const first = captureAriaSnapshot(document.body);
  const second = captureAriaSnapshot(document.body);
  expect([...second.refsByElement]).toEqual([...first.refsByElement]);
  for (const element of document.querySelectorAll("h2,button,p")) {
    const ref = first.refsByElement.get(element);
    expect(ref).toBeDefined();
    expect(first.fullText).toContain(`[ref=${ref}]`);
    expect(first.distilledText).toContain(`[ref=${ref}]`);
  }
  const namelessImage = document.querySelector("img")!;
  const imageRef = first.refsByElement.get(namelessImage);
  expect(imageRef).toBeDefined();
  expect(first.fullText).toContain(`[ref=${imageRef}]`);
  expect(first.distilledText).not.toContain(`[ref=${imageRef}]`);
  expect(await page.ariaSnapshot()).toBe(before);
  expect(await locator.count()).toBe(1);
});
