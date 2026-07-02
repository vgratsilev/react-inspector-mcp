# Roadmap

See [README](../README.md) for setup and [tool reference](REFERENCE.md) for detailed tool behavior.

## Nearest Steps

- Add a clean-install MCP smoke test:
  - install and run the package through `npx -y react-inspector-mcp`;
  - verify MCP `initialize`;
  - verify `tools/list`;
  - call `list_components` against a small React/TypeScript project.
- Keep release checks reproducible:
  - `npm test`;
  - `npm run build`;
  - `npm pack --dry-run`;
  - `git status`.

## Future Improvements

- Improve performance on large React/TypeScript projects.
- Add more scanner edge cases for real-world component patterns.
- Expand compatibility notes for common MCP clients and Node.js environments.
- Add troubleshooting guidance for project path, `tsconfig.json`, path aliases, and scan filters.
- Keep CI, fixture tests, build, and package dry-run green before releases.
