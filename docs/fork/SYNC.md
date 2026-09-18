# Syncing this fork with upstream

Fork-only file. Upstream is `enekesabel/playwright-lite`; it owns `docs/adr/` and its numbering, so fork decisions live here.

## Decision

- `main` mirrors upstream `main`. It only fast-forwards and carries no fork commits.
- Each sync produces one tag, `ayme-<date>`: upstream plus a short queue of fork-only commits on top. Tags are never moved or deleted.
- Consumers (`ayme-labs/ayme`) pin the commit SHA of an `ayme-*` tag, nothing else.

Why: `git log upstream/main..ayme-<date>` is the complete, readable definition of the fork, and no sync rewrites anything. Old pins stay fetchable, and no step needs a force-push.

Keep the queue small, because every queue commit is a recurring conflict cost: send upstream anything it can absorb as a no-op, and fold a fix into the queue commit it belongs to.

## The queue

| Commit                                          | Why it exists                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `feat: add fork-only WebMCP integration`        | Package name, `private`, `./internal` export, injected runtime built from `ayme-labs/playwright` for dual ARIA capture.         |
| `build: commit generated sources`               | Git installs run `prepare`; committed `build/generated` lets that build without cloning Playwright. `generate:check` guards it. |
| `docs: describe the fork and its sync strategy` | Fork text in `docs/readme-template.hbs`, the generated `README.md`, this file.                                                  |

A fork-only change between syncs is a new tag too: branch from the latest `ayme-*` tag, change the queue, continue at step 3.

## Procedure

Run commands through Devbox. `upstream` is the `enekesabel/playwright-lite` remote, `origin` this fork. `<prev>` is the latest `ayme-*` tag.

1. `gh repo sync ayme-labs/playwright-lite`, then `git fetch --tags origin && git fetch upstream`.
2. `git switch -c sync/<date> upstream/main`, then replay the queue: `git cherry-pick $(git merge-base upstream/main <prev>)..<prev>`. Resolve conflicts inside the queue commit they belong to.
3. Set `package.json` `version` to upstream's (`.release-please-manifest.json`). Run `pnpm generate:injected` and `pnpm generate:readme`; amend the results into the build and docs commits. If the injected artifact hash changed, review it before updating the pin in `build/playwrightInjectedPlugin.ts`.
4. `pnpm generate:check`, `pnpm check`, `pnpm test:e2e`.
5. `git push origin sync/<date>`, then `gh workflow run CI --ref sync/<date>`. Do not open a PR: the branch cannot merge into `main` by design.
6. When CI is green: `git tag ayme-<date> && git push origin ayme-<date>`, then delete the `sync/<date>` branch.
7. In `ayme-labs/ayme`, follow its `AGENTS.md` to pin the new tag's SHA.

Never force-push, never push fork commits to `main`, never move or delete an `ayme-*` tag.
