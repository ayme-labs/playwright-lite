import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const expectedArtifactBytes = 331512;
const expectedArtifactSha256 =
  "8517fd96ce7384ba9068116c21ebe3e2d0b61d123483df938b15aa4382ad92df";
const injectedId = "virtual:playwright-lite-injected";
const resolvedInjectedId = `\0${injectedId}`;

export function playwrightInjectedPlugin() {
  return {
    name: "playwright-lite-injected",
    resolveId(id: string) {
      if (id === injectedId) return resolvedInjectedId;
    },
    load(id: string) {
      if (id !== resolvedInjectedId) return;
      const require = createRequire(import.meta.url);
      const yamlPath = resolve(
        dirname(require.resolve("yaml/package.json")),
        "browser/index.js"
      );
      return [
        `import yaml from ${JSON.stringify(yamlPath)};`,
        "const module = { exports: {} };",
        "const exports = module.exports;",
        readInjectedScriptSource(),
        "const LiteInjectedScript = module.exports.InjectedScript();",
        "const liteGetByTestIdSelector = getByTestIdSelector;",
        "const liteParseAriaSnapshot = (text) => { const result = parseAriaSnapshot(yaml, text); if (result.errors.length) throw new Error(result.errors[0].message); return result.fragment; };",
        "export { LiteInjectedScript as InjectedScript, liteGetByTestIdSelector as getByTestIdSelector, liteParseAriaSnapshot as parseAriaSnapshot };",
      ].join("\n");
    },
  };
}

function readInjectedScriptSource(): string {
  const artifact = readFileSync(
    new URL("./generated/injectedScriptSource.ts", import.meta.url)
  );
  const sha256 = createHash("sha256").update(artifact).digest("hex");
  if (
    artifact.byteLength !== expectedArtifactBytes ||
    sha256 !== expectedArtifactSha256
  ) {
    throw new Error(
      "The pinned Playwright InjectedScript artifact does not match the reviewed build."
    );
  }
  const text = artifact.toString("utf8");
  const prefix = "export const source = ";
  if (!text.startsWith(prefix) || !text.endsWith(";"))
    throw new Error("Unsupported InjectedScript artifact format.");
  const source: unknown = JSON.parse(text.slice(prefix.length, -1));
  if (typeof source !== "string")
    throw new Error("InjectedScript source must be a string.");
  return source;
}
