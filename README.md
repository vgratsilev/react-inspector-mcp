# react-inspector-mcp

MCP server for inspecting React/TypeScript projects with `ts-morph`.

It helps find React components, read props and metadata, locate JSX usages, detect unused components, and inspect component dependency graphs.

## Requirements

- Node.js 20+
- A React/TypeScript project with a `tsconfig.json`

## Installation

For a local checkout:

```bash
git clone https://github.com/vgratsilev/react-inspector-mcp.git
cd react-inspector-mcp
npm install
npm run build
```

## MCP Client Configuration

### Production

Use the compiled server from a local checkout:

```json
{
  "mcpServers": {
    "react-inspector-mcp": {
      "command": "node",
      "args": [
        "C:/absolute/path/to/react-inspector-mcp/dist/index.js"
      ]
    }
  }
}
```

### Development

Use the TypeScript entrypoint while working on this server:

```json
{
  "mcpServers": {
    "react-inspector-mcp-dev": {
      "command": "npx",
      "args": [
        "tsx",
        "C:/absolute/path/to/react-inspector-mcp/src/index.ts"
      ]
    }
  }
}
```

On Windows, escaped backslashes in JSON configs are also valid.

## Tool Call Example

After connecting the server, pass the target React project path in tool arguments:

```json
{
  "tool": "list_components",
  "arguments": {
    "projectPath": "C:/absolute/path/to/target-react-project"
  }
}
```

## Tools

- `search_components` - search components by name, path, description, prop names, and prop types.
- `list_components` - list detected components with props and metadata.
- `get_component` - get one component by exact name.
- `find_component_usages` - find JSX usages for one component.
- `find_unused_components` - find components without external JSX usages.
- `get_component_dependencies` - list components used inside one component.
- `get_component_dependents` - list components that use one component.

Full tool inputs, outputs, scan rules, and limitations are documented in [docs/REFERENCE.md](docs/REFERENCE.md).

## Scripts

```bash
npm run dev
npm run build
npm start
npm test
```

- `npm run dev` starts the MCP server from `src/index.ts` using `tsx`.
- `npm run build` compiles TypeScript into `dist`.
- `npm start` starts the compiled MCP server from `dist/index.js`.
- `npm test` runs fixture-based tool tests.

## Project Docs

- [Tool reference](docs/REFERENCE.md)
- [Roadmap](docs/ROADMAP.md)
