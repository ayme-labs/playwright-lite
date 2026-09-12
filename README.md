# Ayme Playwright Lite fork

This fork of [playwright-lite](https://github.com/enekesabel/playwright-lite) is consumed by Ayme WebMCP as an exact-commit Git dependency. It is not published to a package registry.

Use Playwright-typed page objects in the current browser document without a browser process or remote automation connection. This is not an official Microsoft package.

## Usage

```ts
import { createPage } from "@ayme-dev/playwright-lite";

const page = createPage({
  testIdAttribute: "data-test",
  actionTimeout: 5_000,
  navigationTimeout: 10_000,
});

await page.getByTestId("name").fill("Ada");
await page.getByRole("button", { name: "Save" }).click();
```

All options are optional. `createPage()` uses `data-testid`, a 1,000 ms action timeout, and a 30,000 ms navigation timeout. Set a timeout to `0` to disable it. `page.setDefaultTimeout()` and `page.setDefaultNavigationTimeout()` remain available.

Each Page owns its configuration. Creating another Page does not change the test-ID attribute of existing pages or locators. The library does not load `playwright.config.ts` or read WebMCP build constants; WebMCP passes its resolved settings into the factory.

The root exports only `createPage` and `CreatePageOptions`. Page objects continue importing `Page` and `Locator` as types from `@playwright/test`. The tested type peer is Playwright 1.62.1; Playwright's Node runtime is not bundled. Use `page.ariaSnapshot()` or `locator.ariaSnapshot()` for ordinary accessibility snapshots.

## Fork-only integration

`@ayme-dev/playwright-lite/internal` exports `captureAriaSnapshot`, `isPlaywrightLiteLocator`, and `resolveLocatorElements`, plus the capture result type. This entry preserves WebMCP's existing dual ARIA capture and locator-to-DOM identity contract. It is not part of the personal upstream API or WebMCP's public API. Locator brands and implementation classes remain private.

The compatibility corpus stays pinned to stock Playwright 1.62.1 in `tests/upstream/corpus.ts`. Injected code is generated separately from `ayme-labs/playwright@b25d782e3fbdf21abdae60e974e49b78ca07e828`, selected in `scripts/generate-injected.mjs`. The fork patch adds dual capture without adding POM availability policy or changing evaluation semantics.

## Scope

The runtime controls the current window and document. Supported behavior includes locator queries and composition, browser-side input and pointer actions, synthetic keyboard input, element handles, waits, and accessibility snapshots.

Playwright's types describe more capabilities than a script inside a document can provide. Browser launch, browser contexts, other document realms, and browser-process operations are outside the current scope. Keyboard events are synthetic, not trusted input. Native editing defaults such as cursor movement, deletion, and focus traversal are not fully implemented.

Compatibility checks run selected, unchanged stock Playwright tests through this runtime. The reviewed passing baseline is enforced; unsupported diagnostic tests are not advertised as supported behavior. See `tests/upstream/baseline.json` and the promotion rules in `AGENTS.md`.

## Installation and development

Git installation runs `prepare` to build the checked-in generated source. Building from Git uses the contributor toolchain, not the minimum Node version of the built package. WebMCP explicitly allows this dependency's build and bundles the result into its distribution. Its consumers do not install or build the fork.

The packed browser library supports installation and bundling on Node.js 20 or newer. Source development uses Devbox: `devbox.json` selects Node.js 24 and enables Corepack, `devbox.lock` pins the environment, and `packageManager` pins pnpm 11.24.0.

```sh
devbox shell
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm check
```

`pnpm check` builds the package, checks linting and types, runs unit and browser compatibility tests, verifies an isolated packed consumer, and checks formatting.

The generated injected script is committed and hash-checked during builds. Consumers do not generate it. `pnpm generate:check` reproduces the fork artifact and checks the keyboard layout. `pnpm generate:injected` uses Playwright's own generator at the separately pinned fork revision. Review artifact hash changes before updating the build pin. `pnpm upstream:sync` continues to copy the selected tests from the stock corpus revision.

CI runs development checks on Node.js 24.12.0 with Chromium on Ubuntu. A separate Node.js 20.0.0 job installs the checked tarball with engine checks enabled, compiles a consumer POM, and runs it in Chromium without repository development dependencies or a separately installed YAML package. CI does not publish packages.

## License

MIT for this project. Bundled and copied third-party code retains its own license. See `THIRD_PARTY_NOTICES.txt` and `LICENSES`.
