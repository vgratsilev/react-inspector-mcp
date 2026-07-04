# Changelog

## Unreleased

### Added

- Added a packaged MCP smoke test that installs the packed tarball and verifies the stdio handshake, tool listing, and `list_components`.
- Added CI coverage for Node.js 20 and 22, packaged smoke testing, and `npm pack --dry-run`.
- Added `limit`, `offset`, `mode`, and `fields` output controls for broad component tools.
- Added non-JSX reference metadata, usage kinds, and confidence to `find_unused_components`.
- Added component `kind` metadata, prop `defaultValue` metadata, and `componentWrappers` scan options.
- Added scanner coverage for class components, anonymous default exports, styled factories, configured HOCs, and deeper props patterns.
- Added `refresh_project_cache` for explicit project cache refresh in long-running MCP sessions.
- Added `get_component_report` and `get_dependency_graph` for compact agent-facing component analysis.

### Changed

- Refactored component tools to share a per-call scan context, avoiding repeated full usage scans without changing MCP response shapes.
- Changed `list_components` and `search_components` to return paginated envelopes with a default `summary` mode and `limit` of 20.
- Changed `find_unused_components` wording from absolute unused detection toward "no known external usages" candidates.
- Changed project caching to refresh added/deleted source files on subsequent calls and evict idle or least-recently-used projects.

## v1.0.1

### Changed

- Published the package to npm as `react-inspector-mcp`.
- Updated installation instructions for npm/npx and project-local installs.

## v1.0.0

Public v1.0.0 release of `react-inspector-mcp`.

### Added

- npm/npx startup flow for MCP clients.
- React component discovery with props, JSDoc metadata, usages, unused component detection, dependencies, and dependents.
- TypeScript-aware component scanning powered by `ts-morph`.
- Support for path aliases, barrels, re-exports, lazy imports, and supported React wrappers.
- Realistic React fixture coverage for components, pages, app routes, stories/tests, scan filters, and default excludes.

### Notes

- Requires Node.js 20+.
- GitHub release before npm publication.
