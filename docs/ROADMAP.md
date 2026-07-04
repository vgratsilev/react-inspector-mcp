# Roadmap

See [README](../README.md) for setup, [tool reference](REFERENCE.md) for detailed tool behavior, and the [iterative update plan](ITERATIVE_UPDATE_PLAN.md) for the full staged update path.

## Now

Focus: cache lifecycle.

- Improve cache lifecycle for long-running MCP sessions, including refresh behavior and bounded project caching.
- Keep release checks reproducible with `npm test`, `npm run build`, `npm run test:smoke`, `npm pack --dry-run`, and `git status`.

## Next

- Add agent-facing tools for compact component reports and dependency graph navigation.

## Later

- Run a full release pass after functional changes, including package metadata, docs, changelog, package dry-run, and git status.

## Completed

- Scanner coverage:
  - added class components, anonymous default exports, styled factories, and configured HOC wrappers;
  - added component `kind`, prop `defaultValue`, and deeper props extraction for `React.FC`, `FC`, generics, destructuring, and `forwardRef`.
- Unused-component correctness:
  - `find_unused_components` now reports usage kinds, known non-JSX references, confidence, and clearer "no known usages" reasons;
  - JSX-only usage tools keep their existing `usageCount` and `usedIn` behavior.
- Token-safe broad responses:
  - `list_components` and `search_components` return paginated envelopes;
  - default broad output is `summary` mode with `limit: 20`;
  - callers can request `full` mode, offsets, larger limits, and selected fields.
- Shared ScanContext:
  - public tools now share one per-call scan context;
  - wide `search_components` and `find_unused_components` avoid repeated full usage scans;
  - dependency and dependent tools use the same per-call dependency map.
- Release safety:
  - packaged clean-install MCP smoke test;
  - CI on Node.js 20 and 22;
  - CI checks for `npm ci`, `npm test`, `npm run build`, `npm run test:smoke`, and `npm pack --dry-run`.

## Maintenance Rule

After each completed stage, update this roadmap. Update [CHANGELOG.md](../CHANGELOG.md) when behavior, public tool contracts, release-facing docs, or user-visible workflows change.
