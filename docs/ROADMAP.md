# Roadmap

See [README](../README.md) for setup and [tool reference](REFERENCE.md) for detailed tool behavior.

## Now

- Verify the published `v1.1.2` package through npm/npx startup.
- Collect release feedback and issue reports.
- Watch for real-project feedback on bounded usage outputs and unused-candidate pagination.

## Next

- Plan the next focused scanner or agent-workflow iteration from real project feedback.

## Later

- Revisit larger scanner correctness gaps discovered from real projects.

## Completed

- Published `v1.1.2`:
  - pushed release commit `daa4edf` and tag `v1.1.2`;
  - published `react-inspector-mcp@1.1.2` to npm with the `latest` dist-tag;
  - created the GitHub Release for `v1.1.2`.
- Token-safe focused tool responses:
  - added `locationLimit` to `get_component` and `find_component_usages`;
  - changed `find_unused_components` to return paginated envelopes;
  - bounded unused-candidate reference locations by default.
- Release docs:
  - updated `docs/REFERENCE.md` for bounded usage responses and unused pagination;
  - added a release-checklist reminder to verify whether `docs/ROADMAP.md` needs updates.
- Published `v1.1.0`:
  - pushed release commit `0fffae4` and tag `v1.1.0`;
  - published `react-inspector-mcp@1.1.0` to npm with the `latest` dist-tag;
  - created the GitHub Release for `v1.1.0`.
- Release pass:
  - prepared `v1.1.0` release metadata;
  - kept release checks reproducible with `npm test`, `npm run build`, `npm run test:smoke`, `npm pack --dry-run`, and `git status`;
  - confirmed the publication decision for `v1.1.0`.
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
