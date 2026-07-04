# Roadmap

See [README](../README.md) for setup, [tool reference](REFERENCE.md) for detailed tool behavior, and the [iterative update plan](ITERATIVE_UPDATE_PLAN.md) for the full staged update path.

## Now

Focus: release pass.

- Keep release checks reproducible with `npm test`, `npm run build`, `npm run test:smoke`, `npm pack --dry-run`, and `git status`.

## Next

- Decide whether to publish the next package version.

## Later

- Revisit larger scanner correctness gaps discovered from real projects.

## Completed

- Agent-facing tools:
  - added `get_component_report` for compact props, usages, dependencies, dependents, and risk in one call;
  - added `get_dependency_graph` with bounded depth, direction, and node limits.
- Cache lifecycle:
  - added `refresh_project_cache`;
  - refreshed added and deleted source files across long-running sessions;
  - bounded project cache growth with idle TTL and LRU eviction.
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
