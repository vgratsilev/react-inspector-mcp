# Roadmap

See [README](../README.md) for setup and [tool reference](REFERENCE.md) for detailed tool behavior.

## Current Status

- MCP server for React/TypeScript project inspection is implemented.
- Available tools: component search, component listing, single component lookup, JSX usage lookup, unused component detection, dependencies, and dependents.
- Component detection supports functions, variables, `memo`, `forwardRef`, and `lazy`.
- `include` and `exclude` scan filters are implemented.
- Fixture-based tests and GitHub Actions CI are present.

## Nearest Steps

- Update package metadata before public publishing:
  - `author`
  - package visibility decision for `"private": true`
- Review README installation and MCP client configuration sections.
- Run final checks before release:
  - `npm test`
  - `npm run build`
- Review `git status` before the first public commit.
- Create the first public release or git tag after CI passes.

## Before Publishing

- Keep `README.md` focused on setup and quick usage.
- Keep detailed tool behavior in `docs/REFERENCE.md`.
- Ensure `LICENSE` matches `package.json`.
- Make sure generated files are not committed:
  - `dist/`
  - `node_modules/`
  - local `.env*` files
- Keep GitHub Actions CI green.

## Next Milestone

Enable MCP connection without manual local setup, using a GitHub link.

Target outcome:

- A user can point an MCP client to this project from GitHub without cloning and building it manually.
- The package has a proper executable entrypoint for remote execution.
- Documentation includes a ready-to-use MCP client config for running from a GitHub source.

Likely work:

- Add a `bin` entry or equivalent package entrypoint.
- Confirm the server can run after install from git.
- Decide the supported remote run command, for example an `npx`/git-based command.
- Document the exact client configuration.
- Test the flow in a clean environment.

## Later

- Improve dependency graph resolution beyond local component names.
- Add dependency edges for `lazy(() => import(...))` targets.
- Extend support for more complex higher-order components.
- Add more fixture cases for real-world React project structures.
