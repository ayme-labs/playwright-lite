import type { Locator, Page } from "@playwright/test";
import { createPage, type CreatePageOptions } from "@ayme-dev/playwright-lite";
import * as publicExports from "@ayme-dev/playwright-lite";
import {
  captureAriaSnapshot,
  isPlaywrightLiteLocator,
  resolveLocatorElements,
} from "@ayme-dev/playwright-lite/internal";

class ProfilePage {
  readonly name: Locator;
  readonly save: Locator;

  constructor(private readonly page: Page) {
    this.name = page.getByTestId("name");
    this.save = page.getByRole("button", { name: "Save", exact: true });
  }

  async saveName(value: string) {
    await this.name.fill(value);
    await this.name.focus();
    await this.page.keyboard.type("!");
    await this.save.click();
  }
}

export async function runConsumer() {
  const input = document.querySelector<HTMLInputElement>("input")!;
  const button = document.querySelector<HTMLButtonElement>("button")!;
  const output = document.querySelector<HTMLOutputElement>("output")!;
  let clicks = 0;
  let trustedClick: boolean | undefined;
  button.addEventListener("click", (event) => {
    clicks++;
    trustedClick = event.isTrusted;
    output.textContent = input.value;
  });
  const options: CreatePageOptions = {
    testIdAttribute: "data-test",
    actionTimeout: 1_000,
    navigationTimeout: 30_000,
  };
  const page: Page = createPage(options);
  const profile = new ProfilePage(page);
  await profile.saveName("Ada");
  const internalSnapshot = captureAriaSnapshot(document.body);
  const saveRef = internalSnapshot.refsByElement.get(button);
  const resolvedSave = resolveLocatorElements(profile.save);
  return {
    exports: Object.keys(publicExports).sort(),
    value: await profile.name.inputValue(),
    saved: output.textContent,
    clicks,
    trustedClick,
    defaultCount: await createPage().getByTestId("default").count(),
    snapshot: await page.ariaSnapshot(),
    locatorSnapshot: await profile.save.ariaSnapshot(),
    internalIsLocator: isPlaywrightLiteLocator(profile.save),
    internalResolvedSave:
      resolvedSave.length === 1 && resolvedSave[0] === button,
    internalSnapshot: {
      fullText: internalSnapshot.fullText,
      distilledText: internalSnapshot.distilledText,
      saveRef: saveRef ?? null,
    },
  };
}
