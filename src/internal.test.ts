import type { Locator, Page } from "@playwright/test";
import { afterEach, describe, expect, it } from "vitest";
import { createPage } from "./index";
import {
  captureAriaSnapshot,
  generateLocator,
  isPlaywrightLiteLocator,
  isPressableKey,
  pointerHitTarget,
  resolveLocatorElements,
} from "./internal";

afterEach(() => {
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
  window.scrollTo(0, 0);
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

describe("pointerHitTarget", () => {
  /** The centre of the element's box, as a click without a position uses. */
  function centre(element: Element) {
    const rect = element.getBoundingClientRect();
    return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
  }

  /**
   * The real click's own check must agree: a trial click succeeds exactly when
   * no element is in the way and otherwise refuses with the hit element.
   */
  async function expectClickAgrees(
    locator: Locator,
    result: ReturnType<typeof pointerHitTarget>
  ) {
    const click = locator.click({ trial: true, timeout: 200 });
    if (result?.hit === undefined) await expect(click).resolves.toBeUndefined();
    else await expect(click).rejects.toThrow("does not receive pointer events");
  }

  it("reaches a plain visible button at its centre", async () => {
    document.body.innerHTML = '<button style="margin:20px">Save</button>';
    const page = createPage();
    const button = document.querySelector("button")!;
    const result = pointerHitTarget(page, button);
    expect(result).toEqual({ point: centre(button) });
    await expectClickAgrees(page.getByRole("button"), result);
  });

  it("reports a sibling that covers the button", async () => {
    document.body.innerHTML =
      '<div style="position:relative;width:200px;height:100px"><button style="width:200px;height:100px">Save</button><div id="cover" style="position:absolute;inset:0"></div></div>';
    const page = createPage();
    const button = document.querySelector("button")!;
    const result = pointerHitTarget(page, button);
    expect(result).toEqual({
      point: centre(button),
      hit: document.getElementById("cover"),
    });
    await expectClickAgrees(page.getByRole("button"), result);
  });

  it("reports an overlay that covers only the centre, where the click lands", async () => {
    document.body.innerHTML =
      '<div style="position:relative;width:200px;height:100px"><button style="width:200px;height:100px">Save</button><div id="cover" style="position:absolute;top:0;bottom:0;left:20%;width:60%"></div></div>';
    const page = createPage();
    const button = document.querySelector("button")!;
    const result = pointerHitTarget(page, button);
    expect(result).toEqual({
      point: centre(button),
      hit: document.getElementById("cover"),
    });
    await expectClickAgrees(page.getByRole("button"), result);
  });

  it("reports the parent of a button that takes no pointer events", async () => {
    document.body.innerHTML =
      '<div id="parent" style="padding:20px"><button style="pointer-events:none">Save</button></div>';
    const page = createPage();
    const button = document.querySelector("button")!;
    const result = pointerHitTarget(page, button);
    expect(result).toEqual({
      point: centre(button),
      hit: document.getElementById("parent"),
    });
    await expectClickAgrees(page.getByRole("button"), result);
  });

  it("is undefined below the fold until the button is scrolled into view", async () => {
    document.body.style.height = "5000px";
    document.body.style.margin = "0";
    document.body.innerHTML =
      '<button style="position:absolute;top:4000px">Save</button>';
    const page = createPage();
    const button = document.querySelector("button")!;
    expect(pointerHitTarget(page, button)).toBeUndefined();
    button.scrollIntoView();
    const result = pointerHitTarget(page, button);
    expect(result).toEqual({ point: centre(button) });
    expect(result!.point.y).toBeLessThan(window.innerHeight);
    await expectClickAgrees(page.getByRole("button"), result);
  });

  it("is undefined for an element that is not rendered or not connected", async () => {
    document.body.innerHTML = '<button style="display:none">Save</button>';
    const page = createPage();
    const button = document.querySelector("button")!;
    expect(pointerHitTarget(page, button)).toBeUndefined();
    await expect(
      page.getByRole("button").click({ trial: true, timeout: 200 })
    ).rejects.toThrow("Timeout");
    button.remove();
    expect(pointerHitTarget(page, button)).toBeUndefined();
  });

  it("looks into an open shadow root", async () => {
    document.body.innerHTML = '<x-host id="host"></x-host>';
    const host = document.getElementById("host")!;
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML =
      '<div style="position:relative;width:200px;height:100px"><button style="width:200px;height:100px">Save</button><div id="cover" style="position:absolute;inset:0;display:none"></div></div>';
    const page = createPage();
    const button = shadow.querySelector("button")!;
    const cover = shadow.getElementById("cover")!;
    const result = pointerHitTarget(page, button);
    expect(result).toEqual({ point: centre(button) });
    await expectClickAgrees(page.getByRole("button"), result);
    cover.style.display = "block";
    const covered = pointerHitTarget(page, button);
    expect(covered).toEqual({ point: centre(button), hit: cover });
    await expectClickAgrees(page.getByRole("button"), covered);
  });

  it("names the element inside a covering shadow host", async () => {
    document.body.innerHTML =
      '<div style="position:relative;width:200px;height:100px"><button style="width:200px;height:100px">Save</button><x-cover id="cover" style="position:absolute;inset:0;display:block"></x-cover></div>';
    const cover = document.getElementById("cover")!;
    const shadow = cover.attachShadow({ mode: "open" });
    shadow.innerHTML = '<div id="inner" style="width:100%;height:100%"></div>';
    const page = createPage();
    const button = document.querySelector("button")!;
    const result = pointerHitTarget(page, button);
    expect(result).toEqual({
      point: centre(button),
      hit: shadow.getElementById("inner"),
    });
    await expectClickAgrees(page.getByRole("button"), result);
  });

  it("retargets content inside a button to the button", async () => {
    document.body.innerHTML = "<button><span>Save</span></button>";
    const page = createPage();
    const span = document.querySelector("span")!;
    const result = pointerHitTarget(page, span);
    expect(result).toEqual({ point: centre(span) });
    await expectClickAgrees(page.locator("span"), result);
  });

  it("rejects a page that is not a playwright-lite Page", () => {
    document.body.innerHTML = "<button>Save</button>";
    expect(() =>
      pointerHitTarget({} as Page, document.querySelector("button")!)
    ).toThrow(
      new TypeError("pointerHitTarget: expected a playwright-lite Page.")
    );
  });
});

it.each([
  ["a", true],
  ["A", true],
  ["ArrowLeft", true],
  ["KeyA", true],
  ["ControlOrMeta+A", true],
  ["Shift+ArrowLeft", true],
  ["+", true],
  ["Control++", true],
  ["", false],
  ["Foo", false],
  ["é", false],
  ["a+b", false],
  ["Control+", false],
  ["Foo+a", false],
])(
  "isPressableKey(%j) is %s, as keyboard.press finds it",
  async (key, pressable) => {
    document.body.innerHTML = "<input>";
    document.querySelector("input")!.focus();
    const page = createPage();
    const pressed = await page.keyboard.press(key).then(
      () => true,
      (error: Error) => {
        expect(error.message).toContain("Unknown key");
        return false;
      }
    );
    expect(pressed).toBe(pressable);
    expect(isPressableKey(key)).toBe(pressable);
  }
);
