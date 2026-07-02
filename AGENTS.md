# AGENTS.md

## Project

`react-inspector-mcp` is a TypeScript ESM MCP server for inspecting React components with `ts-morph`.

## Commands

- Install: `npm install`
- Development: `npm run dev`
- Tests: `npm test`
- Build: `npm run build`

After changes in `src/` or `tests/`, run:

```bash
npm test
npm run build
```

## Development Rules

- Use Node.js `>=20`.
- Do not commit `node_modules/`, `dist/`, `.env*`, or local IDE/agent files.
- Write code in TypeScript with ESM imports.
- Use `zod` for external input validation.
- Prefer `ts-morph` for TypeScript/React analysis instead of regex parsing.
- Cover new scanner behavior with fixture tests in `tests/fixtures/react-project`.
- Update `docs/REFERENCE.md` when MCP tool behavior changes.
- Keep `README.md` focused on setup and quick usage. Keep detailed tool behavior in `docs/REFERENCE.md`.

## Release Checklist

- Check `package.json`: `author`, `license`, `private`, and `repository`.
- Run `npm test`, `npm run build`, and `npm pack --dry-run`.
- Check `git status`.
- Do not publish the package until the npm/public release decision is explicit.
