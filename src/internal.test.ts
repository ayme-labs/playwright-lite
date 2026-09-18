import { afterEach, expect, it } from "vitest";
import { createPage } from "./index";
import {
  captureAriaSnapshot,
  generateLocator,
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

/** Evaluates a generated locator string on `base`, the way code would use it. */
function resolveGenerated(base: object, locator: string) {
  const built = new Function("base", `return base.${locator};`)(base) as object;
  return resolveLocatorElements(built);
}

it("generates Playwright's codegen locator for an element on the page", () => {
  document.body.innerHTML =
    '<h1>Inbox</h1><button data-testid="archive">Archive</button><button>Save</button><button>Copy</button><button>Copy</button>';
  const page = createPage();
  captureAriaSnapshot(document.body);
  const [archive, save, , secondCopy] = document.querySelectorAll("button");
  const heading = document.querySelector("h1")!;
  expect(generateLocator(page, archive)).toBe("getByTestId('archive')");
  expect(generateLocator(page, save)).toBe(
    "getByRole('button', { name: 'Save' })"
  );
  expect(generateLocator(page, heading)).toBe(
    "getByRole('heading', { name: 'Inbox' })"
  );
  expect(generateLocator(page, secondCopy)).toBe(
    "getByRole('button', { name: 'Copy' }).nth(1)"
  );
  for (const element of [archive, save, heading, secondCopy]) {
    const locator = generateLocator(page, element);
    expect(locator).not.toContain("aria-ref");
    expect(resolveGenerated(page, locator)).toEqual([element]);
  }
});

it("uses the test ID attribute the page was created with", () => {
  document.body.innerHTML = '<button data-qa="save">Save</button>';
  const button = document.querySelector("button")!;
  expect(generateLocator(createPage(), button)).toBe(
    "getByRole('button', { name: 'Save' })"
  );
  expect(
    generateLocator(createPage({ testIdAttribute: "data-qa" }), button)
  ).toBe("getByTestId('save')");
});

it("generates a locator relative to a root element", () => {
  document.body.innerHTML =
    "<ul><li>Alpha <button>Delete</button></li><li>Beta <button>Delete</button></li></ul>";
  const page = createPage();
  const rows = document.querySelectorAll("li");
  const button = rows[1].querySelector("button")!;
  expect(generateLocator(page, button)).toBe(
    "getByRole('listitem').filter({ hasText: 'Beta Delete' }).getByRole('button')"
  );
  const locator = generateLocator(page, button, { root: rows[1] });
  expect(locator).toBe("getByRole('button', { name: 'Delete' })");
  expect(resolveGenerated(page.locator("li").nth(1), locator)).toEqual([
    button,
  ]);
  expect(() => generateLocator(page, button, { root: rows[0] })).toThrow(
    "Target element must belong to the root's subtree"
  );
});

it("generates the interactive ancestor's locator for content inside it", () => {
  document.body.innerHTML =
    '<button><svg width="10" height="10"></svg> Save</button><a href="#home"><span>Home</span></a>';
  const page = createPage();
  expect(generateLocator(page, document.querySelector("svg")!)).toBe(
    "getByRole('button', { name: 'Save' })"
  );
  expect(generateLocator(page, document.querySelector("span")!)).toBe(
    "getByRole('link', { name: 'Home' })"
  );
});

it("rejects a page that is not a playwright-lite Page", () => {
  document.body.innerHTML = "<button>Save</button>";
  expect(() =>
    generateLocator({} as never, document.querySelector("button")!)
  ).toThrow("generateLocator: expected a playwright-lite Page.");
});
