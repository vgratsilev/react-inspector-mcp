# Roadmap

See [README](../README.md) for setup, [tool reference](REFERENCE.md) for detailed tool behavior, and the [iterative update plan](ITERATIVE_UPDATE_PLAN.md) for the full staged update path.

## Now

Focus: release safety before larger scanner and API-facing changes.

- Add a clean-install MCP smoke test:
  - build the package through `npm pack`;
  - install it into a temporary project;
  - run the packed server as a subprocess;
  - verify MCP `initialize`;
  - verify `tools/list`;
  - call `list_components` against a small React/TypeScript project.
- Add CI for `npm ci`, `npm test`, `npm run build`, and `npm pack --dry-run`.
- Keep release checks reproducible with `npm test`, `npm run build`, `npm pack --dry-run`, and `git status`.

## Next

- Add a shared `ScanContext` so public tools do not repeat full project scans.
- Add output limits, pagination or cursors, `summary` mode, and field selection for broad responses.
- Make `find_unused_components` more explicit about usage kinds, confidence, and "no known usages" risk.

## Later

- Expand scanner coverage for class components, configured HOCs, anonymous default exports, styled factories, and deeper props extraction.
- Improve cache lifecycle for long-running MCP sessions, including refresh behavior and bounded project caching.
- Add agent-facing tools for compact component reports and dependency graph navigation.
- Run a full release pass after functional changes, including package metadata, docs, changelog, package dry-run, and git status.

## Maintenance Rule

After each completed stage, update this roadmap. Update [CHANGELOG.md](../CHANGELOG.md) when behavior, public tool contracts, release-facing docs, or user-visible workflows change.
