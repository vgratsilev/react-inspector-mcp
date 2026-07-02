# Roadmap

## Current Status

- MCP server for React/TypeScript project inspection is implemented.
- Available tools: component search, component listing, single component lookup, JSX usage lookup, unused component detection, dependencies, and dependents.
- Component detection supports functions, variables, `memo`, `forwardRef`, and `lazy`.
- `include` and `exclude` scan filters are implemented.
- Fixture-based tests and GitHub Actions CI are present.

## Nearest Steps

- Configure the GitHub repository remote for the project.
- Update package metadata before public publishing:
  - `author`
  - `repository`
  - package visibility decision for `"private": true`
- Review README installation and MCP client configuration sections.
- Run final checks before release:
  - `npm test`
  - `npm run build`
- Create the first public release or git tag after CI passes.

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
