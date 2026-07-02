# react-project-mcp

MCP server for inspecting React projects with `ts-morph`.

The server exposes tools for finding React components, reading props and metadata, locating JSX usages, detecting unused components, and exploring component dependency graphs.

## Requirements

- Node.js
- A React/TypeScript project with a `tsconfig.json`

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

## Installation

Clone and build the MCP server:

```bash
git clone https://github.com/your-name/react-project-mcp.git
cd react-project-mcp
npm install
npm run build
```

Use the compiled server for normal MCP client configuration:

```bash
node C:/absolute/path/to/react-project-mcp/dist/index.js
```

For local development, you can run the TypeScript entry directly:

```bash
npx tsx C:/absolute/path/to/react-project-mcp/src/index.ts
```

## MCP Client Configuration

Most MCP clients accept a JSON config with a server name, command, and args.

Compiled server:

```json
{
  "mcpServers": {
    "react-project-mcp": {
      "command": "node",
      "args": [
        "C:/absolute/path/to/react-project-mcp/dist/index.js"
      ]
    }
  }
}
```

Development server:

```json
{
  "mcpServers": {
    "react-project-mcp-dev": {
      "command": "npx",
      "args": [
        "tsx",
        "C:/absolute/path/to/react-project-mcp/src/index.ts"
      ]
    }
  }
}
```

On Windows JSON configs, escaped backslashes are also valid:

```json
{
  "command": "node",
  "args": [
    "C:\\Users\\you\\Projects\\react-project-mcp\\dist\\index.js"
  ]
}
```

After connecting the server, pass the target React project path to tools:

```json
{
  "projectPath": "C:/absolute/path/to/target-react-project"
}
```

## Common Input

All tools require `projectPath`.

```json
{
  "projectPath": "C:/absolute/path/to/react-project"
}
```

`projectPath` must point to the project root containing `tsconfig.json`.

All tools also accept optional scan filters:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "include": ["src/**/*.tsx"],
  "exclude": ["**/*.test.tsx", "**/*.stories.tsx"]
}
```

`include` and `exclude` are glob-like patterns relative to `projectPath`.

Default excludes:

- `**/node_modules/**`
- `**/dist/**`
- `**/.next/**`
- `**/storybook-static/**`

## Response Shapes

### Component

```json
{
  "name": "Button",
  "path": "C:/project/src/components/Button.tsx",
  "declaration": {
    "filePath": "C:/project/src/components/Button.tsx",
    "line": 10,
    "column": 1
  },
  "props": [
    {
      "name": "title",
      "type": "string",
      "optional": false
    }
  ],
  "description": "Primary button component",
  "exported": true,
  "defaultExport": false
}
```

### Component With Usages

```json
{
  "name": "Button",
  "path": "C:/project/src/components/Button.tsx",
  "declaration": {
    "filePath": "C:/project/src/components/Button.tsx",
    "line": 10,
    "column": 1
  },
  "props": [],
  "description": "Primary button component",
  "exported": true,
  "defaultExport": false,
  "usageCount": 1,
  "usedIn": [
    {
      "filePath": "C:/project/src/pages/Home.tsx",
      "line": 12,
      "column": 9,
      "kind": "jsx",
      "text": "<Button title=\"Save\" />"
    }
  ]
}
```

`usageCount` counts JSX usages outside the component declaration file.

## Tools

### `search_components`

Searches React components and returns props, metadata, and JSX usages.

Search includes:

- component name
- source file path
- JSDoc description
- prop names
- prop types

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "query": "button",
  "include": ["src/**/*.tsx"],
  "exclude": ["**/*.test.tsx"]
}
```

`query` is optional. If omitted or empty, all components are returned.

### `list_components`

Lists React components with props and metadata. This tool does not scan usages.

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project"
}
```

Use this when you only need the component inventory.

### `get_component`

Gets one React component by exact component name.

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "componentName": "Button",
  "includeUsages": true
}
```

- `componentName` is case-insensitive but must otherwise match the component name.
- `includeUsages` defaults to `true`.

Output when not found:

```json
{
  "found": false,
  "componentName": "Button",
  "message": "Component \"Button\" was not found in the scanned project."
}
```

### `find_component_usages`

Finds JSX usage locations for one component by exact component name.

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "componentName": "Button"
}
```

Output when found:

```json
{
  "usageCount": 1,
  "usedIn": [
    {
      "filePath": "C:/project/src/pages/Home.tsx",
      "line": 12,
      "column": 9,
      "kind": "jsx",
      "text": "<Button title=\"Save\" />"
    }
  ]
}
```

Output when the component is not found:

```json
{
  "found": false,
  "componentName": "Button",
  "message": "Component \"Button\" was not found in the scanned project."
}
```

### `find_unused_components`

Finds React components that have no JSX usages outside their declaration file.

Output includes:

- `reason`: currently `no_external_jsx_usages`
- `risk`: `high`, `medium`, or `low`

Risk rules:

- `high`: component is not exported and has no external JSX usages
- `medium`: component is exported and has no external JSX usages
- `low`: component is default-exported and has no external JSX usages

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project"
}
```

Output:

```json
[
  {
    "name": "OldButton",
    "path": "C:/project/src/components/OldButton.tsx",
    "declaration": {
      "filePath": "C:/project/src/components/OldButton.tsx",
      "line": 4,
      "column": 1
    },
    "props": [],
    "exported": true,
    "defaultExport": false,
    "usageCount": 0,
    "usedIn": [],
    "reason": "no_external_jsx_usages",
    "risk": "medium"
  }
]
```

### `get_component_dependencies`

Lists components used inside one React component.

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "componentName": "Dashboard"
}
```

Output:

```json
{
  "componentName": "Dashboard",
  "dependencies": [
    {
      "name": "Button",
      "path": "C:/project/src/components/Button.tsx",
      "usages": [
        {
          "filePath": "C:/project/src/components/Dashboard.tsx",
          "line": 8,
          "column": 7,
          "kind": "jsx",
          "text": "<Button title=\"Open\" />"
        }
      ]
    }
  ]
}
```

### `get_component_dependents`

Lists components that use one React component.

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "componentName": "Button"
}
```

Output:

```json
{
  "componentName": "Button",
  "dependents": [
    {
      "name": "Dashboard",
      "path": "C:/project/src/components/Dashboard.tsx",
      "usages": [
        {
          "filePath": "C:/project/src/components/Dashboard.tsx",
          "line": 8,
          "column": 7,
          "kind": "jsx",
          "text": "<Button title=\"Open\" />"
        }
      ]
    }
  ]
}
```

## Detection Rules

A component is currently detected when:

- it is a function declaration or variable declaration;
- its name starts with an uppercase letter;
- its implementation contains JSX.

Supported declaration examples:

```tsx
export function Button(props: ButtonProps) {
  return <button>{props.children}</button>;
}
```

```tsx
export const Button = (props: ButtonProps) => {
  return <button>{props.children}</button>;
};
```

```tsx
export const Button = memo((props: ButtonProps) => {
  return <button>{props.children}</button>;
});
```

```tsx
export const Input = forwardRef((props: InputProps, ref) => {
  return <input ref={ref} value={props.value} />;
});
```

```tsx
export const LazyPanel = lazy(() => import("./Panel"));
```

The scanner recognizes `memo`, `React.memo`, `forwardRef`, and `React.forwardRef` wrappers when JSX is inside the wrapped function. It also recognizes `lazy` and `React.lazy` variable declarations as components.

## Usage Rules

Usages are counted only when a component reference appears inside:

- `JsxOpeningElement`, for example `<Button></Button>`
- `JsxSelfClosingElement`, for example `<Button />`

The scanner intentionally ignores imports, exports, type references, arrays, and other non-JSX references.

Usage resolution follows TypeScript symbols where possible, so alias imports and barrel exports are supported when the target project's `tsconfig.json` can resolve them.

## Testing

The test suite uses a mock React project in `tests/fixtures/react-project`.

Covered cases:

- props and JSDoc extraction
- declaration locations
- JSX usage tracking
- ignored non-JSX references
- alias imports and barrel exports
- `memo`, `forwardRef`, and `lazy`
- unused component risk
- component dependencies and dependents
- `include` and `exclude` scan filters

Run:

```bash
npm test
```

## Known Limitations

- Complex higher-order components beyond `memo`, `forwardRef`, and `lazy` are not fully recognized.
- Dependency graph resolution currently matches component JSX tags by local component name.
- Lazy import targets are detected as lazy component declarations, but the imported target is not expanded into a dependency edge.
- Usage scanning excludes JSX usages inside the component's own declaration file.
- Results depend on the target project's `tsconfig.json`.

## Before Publishing to GitHub

Recommended checklist:

- Update `package.json` metadata:
  - `description`
  - `author`
  - `license`
  - `repository`
  - `keywords`
- Decide whether the package should remain private. For a public GitHub-only project, `"private": true` is fine. For npm publishing, remove it.
- Add a `LICENSE` file that matches `package.json`.
- Run checks:

```bash
npm test
npm run build
```

- Make sure generated files are not committed:
  - `dist/`
  - `node_modules/`
  - local `.env*` files
- Review `git status` before the first commit.
- Add GitHub Actions for CI if you want automated validation on pull requests.

Example minimal GitHub Actions workflow:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
```
