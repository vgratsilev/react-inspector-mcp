# react-inspector-mcp

MCP server for inspecting React/TypeScript projects with `ts-morph`.

It helps find React components, read props and metadata, locate JSX usages, detect unused components, and inspect component dependency graphs.

## Requirements

- Node.js 20+
- A React/TypeScript project with a `tsconfig.json`

## Installation

```bash
git clone https://github.com/vgratsilev/react-inspector-mcp.git
cd react-inspector-mcp
npm install
npm run build
```

## MCP Client Configuration

Use the compiled server for normal MCP client configuration:

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

For local development:

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

After connecting the server, pass the target React project path to tools:

```json
{
  "projectPath": "C:/absolute/path/to/target-react-project"
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

## Transport

The server uses stdio transport:

```ts
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Project Docs

- [Tool reference](docs/REFERENCE.md)
- [Roadmap](docs/ROADMAP.md)
