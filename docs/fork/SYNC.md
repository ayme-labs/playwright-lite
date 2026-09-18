# Syncing this fork with upstream

Fork-only file. Upstream is `enekesabel/playwright-lite`; it owns `docs/adr/` and its numbering, so fork decisions live here.

## Decision

`main` is always upstream `main` plus a short queue of fork-only commits on top. A sync replays the queue onto the new upstream tip; it never merges upstream in.

Why: `git log upstream/main..main` is then the complete, readable definition of the fork. Merges would interleave fork fixes with upstream history and hide what the fork changes.

Consequences:

- Every sync rewrites `main` (force-update). A sync PR exists for CI and review only. Never merge or squash it; the owner resets `main` to the reviewed branch tip.
- Rewritten commits become unreachable, and consumers pin exact SHAs. Tag every SHA a consumer pins before `main` moves.
- Each queue commit is a recurring conflict cost. Keep the queue small: send upstream anything it can absorb as a no-op, and fold fixes into the queue commit they belong to at the next sync.

## The queue

| Commit                                          | Why it exists                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `feat: add fork-only WebMCP integration`        | Package name, `private`, `./internal` export, injected runtime built from `ayme-labs/playwright` for dual ARIA capture.         |
| `build: commit generated sources`               | Git installs run `prepare`; committed `build/generated` lets that build without cloning Playwright. `generate:check` guards it. |
| `docs: describe the fork and its sync strategy` | Fork text in `docs/readme-template.hbs`, the generated `README.md`, this file.                                                  |

Between syncs, fork-only PRs squash onto `main` as usual and join the queue.

## Procedure

Run commands through Devbox. `upstream` is the `enekesabel/playwright-lite` remote.

1. Tag the current tip and push the tag: `git tag archive/pre-sync-<date> origin/main`.
2. `git fetch upstream`, branch `sync/upstream-main-<date>` from `origin/main`, then `git rebase upstream/main`. Fold fixup commits into their queue commit.
3. Set `package.json` `version` to upstream's (`.release-please-manifest.json`). Run `pnpm generate:injected` and `pnpm generate:readme`; amend the results into the build and docs commits. If the injected artifact hash changed, review it before updating the pin in `build/playwrightInjectedPlugin.ts`.
4. `pnpm generate:check`, `pnpm check`, `pnpm test:e2e`.
5. Push the branch and open a draft PR for review. The PR conflicts with the old `main`, so GitHub skips its `pull_request` CI; run it with `gh workflow run CI --ref sync/upstream-main-<date>`. After review the owner force-updates `main` to the branch tip.
6. Tag the new tip if a consumer will pin it, then bump the pin in the consumer (`ayme-labs/ayme`).
