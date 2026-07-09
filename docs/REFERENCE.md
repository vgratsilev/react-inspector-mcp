# Tool Reference

Detailed reference for `react-inspector-mcp` tools, inputs, response shapes, scan rules, and limitations.

## Runtime

Requires Node.js 20+.

Production MCP config through `npx`:

```json
{
  "mcpServers": {
    "react-inspector-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "react-inspector-mcp"
      ]
    }
  }
}
```

Local development config:

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
  "exclude": ["**/*.test.tsx", "**/*.stories.tsx"],
  "componentWrappers": ["observer", "mobx.observer", "connect"]
}
```

`include` and `exclude` are glob-like patterns relative to `projectPath`.
`componentWrappers` adds custom HOC/wrapper callees to the built-in React
wrapper allowlist. Values are exact callee names.

Default excludes:

- `**/node_modules/**`
- `**/dist/**`
- `**/.next/**`
- `**/storybook-static/**`

## Cache Lifecycle

The server keeps a bounded `ts-morph` project cache for long-running MCP
sessions.

- Cache key: `projectPath` plus `<projectPath>/tsconfig.json`.
- `include`, `exclude`, and `componentWrappers` are per-call scan options and
  do not create separate cached projects.
- Each tool call refreshes cached source files and reloads files from
  `tsconfig.json`, so added and deleted files are reflected on the next call.
- Idle project entries are evicted after 30 seconds.
- The cache keeps at most 5 project entries and evicts least-recently-used
  entries when the limit is exceeded.
- Use `refresh_project_cache` when a client wants an explicit refresh before a
  follow-up tool call.

## Broad Output Options

`list_components` and `search_components` return paginated broad responses.
They accept:

- `limit`: max returned components, default `20`.
- `offset`: zero-based result offset, default `0`.
- `mode`: `summary` or `full`, default `summary`.
- `fields`: optional top-level component fields to include.

Supported `fields` values:

- `name`
- `kind`
- `path`
- `declaration`
- `props`
- `description`
- `exported`
- `defaultExport`
- `usageCount`
- `usedIn`

`summary` mode keeps props compact as `{ "name": "...", "optional": false }`
and does not include full prop types. For `search_components`, summary mode
includes `usageCount` by default but not `usedIn`.
Request `usedIn` with `mode: "full"`.

`kind` is one of `function`, `class`, `wrapped`, `lazy`, or `styled`.

For compact navigation in large projects, request only the fields an agent
needs, for example `fields: ["name", "kind", "path"]`.

Use `mode: "full"` with an explicit larger `limit` when you need the old full
component shape for many components.

## Response Shapes

### Paginated Response

```json
{
  "items": [],
  "total": 42,
  "returned": 20,
  "truncated": true,
  "nextOffset": 20
}
```

`nextOffset` is `null` when there are no more results.
This shape is used by broad component tools and by
`find_unused_components`.

### Summary Component

```json
{
  "name": "Button",
  "kind": "function",
  "path": "C:/project/src/components/Button.tsx",
  "props": [
    {
      "name": "title",
      "optional": false
    }
  ],
  "description": "Primary button component",
  "exported": true,
  "defaultExport": false
}
```

### Component

```json
{
  "name": "Button",
  "kind": "function",
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

Full props include `defaultValue` only when the scanner can read a default from
object destructuring, for example `{ tone = "info" }`.

### Component With Bounded Usages

`get_component` and `find_component_usages` limit returned usage locations with
`locationLimit`. `usageCount` is always the total count.

```json
{
  "name": "Button",
  "kind": "function",
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
  "usageCount": 42,
  "returned": 20,
  "truncated": true,
  "locationLimit": 20,
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
`truncated` is `true` when more locations exist than were returned.

Dependency and dependent usage locations can also use `kind: "lazy_import"`
when the edge comes from `lazy(() => import(...))` or `React.lazy`.

## Tools

### `search_components`

Searches React components and returns paginated props and usage metadata.

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
  "limit": 20,
  "offset": 0,
  "mode": "summary",
  "include": ["src/**/*.tsx"],
  "exclude": ["**/*.test.tsx"],
  "componentWrappers": ["observer"]
}
```

`query` is optional. If omitted or empty, all components are returned.
By default, each item includes compact props and `usageCount`. Use
`mode: "full"` to include full prop types and `usedIn` usage locations.

### `list_components`

Lists React components with paginated props and metadata. This tool does not
scan usages.

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "limit": 20,
  "offset": 0,
  "mode": "summary"
}
```

Use this when you only need the component inventory.
Use `mode: "full"` for declaration locations and full prop types.

### `get_component`

Gets one React component by exact component name.

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "componentName": "Button",
  "includeUsages": true,
  "locationLimit": 20
}
```

- `componentName` is case-insensitive but must otherwise match the component name.
- `includeUsages` defaults to `true`.
- `locationLimit` defaults to `20` and limits returned `usedIn` locations.

Output when not found:

```json
{
  "found": false,
  "componentName": "Button",
  "message": "Component \"Button\" was not found in the scanned project."
}
```

### `get_component_report`

Gets one compact agent-facing component report by exact component name. Use
this for the common task "what is this component and who uses it".

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "componentName": "Button",
  "locationLimit": 20,
  "includeSourceText": false
}
```

- `locationLimit` defaults to `20` and limits locations in each report section.
- `includeSourceText` defaults to `false`; when `true`, compact locations also
  include `text`.

Output:

```json
{
  "component": {
    "name": "Button",
    "kind": "function",
    "path": "C:/project/src/components/Button.tsx",
    "declaration": {
      "filePath": "C:/project/src/components/Button.tsx",
      "line": 10,
      "column": 1
    },
    "exported": true,
    "defaultExport": false
  },
  "propsSummary": [
    {
      "name": "title",
      "optional": false
    }
  ],
  "usages": {
    "usageCount": 4,
    "returned": 2,
    "locations": [
      {
        "filePath": "C:/project/src/pages/Home.tsx",
        "line": 12,
        "column": 9,
        "kind": "jsx"
      }
    ]
  },
  "dependencies": [
    {
      "name": "Icon",
      "path": "C:/project/src/components/Icon.tsx",
      "usageCount": 1,
      "returned": 1,
      "usages": [
        {
          "filePath": "C:/project/src/components/Button.tsx",
          "line": 14,
          "column": 7,
          "kind": "jsx"
        }
      ]
    }
  ],
  "dependents": [],
  "risk": {
    "candidate": false,
    "confidence": null,
    "reason": "has_external_jsx_usages",
    "usageKinds": [],
    "referenceCount": 0,
    "returnedReferences": 0,
    "references": []
  }
}
```

When `risk.candidate` is `true`, `confidence`, `reason`, `usageKinds`, and
`references` use the same semantics as `find_unused_components`.

### `get_dependency_graph`

Gets a compact dependency graph rooted at one component.

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "componentName": "Dashboard",
  "direction": "both",
  "depth": 1,
  "maxNodes": 50
}
```

- `direction`: `dependencies`, `dependents`, or `both`; default `both`.
- `depth`: graph depth from the root, default `1`, max `5`.
- `maxNodes`: max returned nodes before truncation, default `50`.

Output:

```json
{
  "root": "C:/project/src/components/Dashboard.tsx#Dashboard",
  "nodes": [
    {
      "id": "C:/project/src/components/Dashboard.tsx#Dashboard",
      "name": "Dashboard",
      "kind": "function",
      "path": "C:/project/src/components/Dashboard.tsx"
    },
    {
      "id": "C:/project/src/components/Button.tsx#Button",
      "name": "Button",
      "kind": "function",
      "path": "C:/project/src/components/Button.tsx"
    }
  ],
  "edges": [
    {
      "from": "C:/project/src/components/Dashboard.tsx#Dashboard",
      "to": "C:/project/src/components/Button.tsx#Button",
      "usageCount": 1,
      "returned": 1,
      "usageKinds": ["jsx"],
      "usages": [
        {
          "filePath": "C:/project/src/components/Dashboard.tsx",
          "line": 8,
          "column": 7,
          "kind": "jsx"
        }
      ]
    }
  ],
  "depth": 1,
  "direction": "both",
  "truncated": false
}
```

Graph node ids use `path#name` so same-name components in different files are
separate nodes. Edge locations are compact and omit source text.

### `find_component_usages`

Finds JSX usage locations for one component by exact component name.

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "componentName": "Button",
  "locationLimit": 20
}
```

- `locationLimit` defaults to `20` and limits returned `usedIn` locations.

Output when found:

```json
{
  "usageCount": 42,
  "returned": 20,
  "truncated": true,
  "locationLimit": 20,
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

Finds React components that have no external JSX usages and reports whether
known non-JSX references make the result risky. This tool reports candidates
with "no known external usages"; it does not prove that a component is safe to
delete.

Output includes:

- `reason`: `no_known_external_usages` or
  `no_external_jsx_usages_but_has_known_references`
- `usageKinds`: known non-JSX reference kinds found for the component
- `referenceCount`: total known non-JSX references
- `returnedReferences`: returned reference locations after `locationLimit`
- `references`: compact source locations for known non-JSX references
- `confidence`: `high`, `medium`, or `low`
- `risk`: legacy alias for `confidence`

Confidence rules:

- `low`: component has known non-JSX references
- `low`: component is default-exported
- `medium`: component is named-exported
- `high`: local component has no known external usages

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "limit": 20,
  "offset": 0,
  "locationLimit": 20,
  "includeSourceText": false
}
```

- `limit` and `offset` page unused candidates.
- `locationLimit` limits returned `references` per candidate. Use `0` for
  counts only.
- `includeSourceText` defaults to `false`; when `true`, reference locations
  also include `text`.

Output:

```json
{
  "items": [
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
      "reason": "no_external_jsx_usages_but_has_known_references",
      "usageKinds": ["route_config_reference"],
      "referenceCount": 1,
      "returnedReferences": 1,
      "references": [
        {
          "filePath": "C:/project/src/routes.ts",
          "line": 8,
          "column": 16,
          "kind": "route_config_reference"
        }
      ],
      "confidence": "low",
      "risk": "low"
    }
  ],
  "total": 42,
  "returned": 20,
  "truncated": true,
  "nextOffset": 20
}
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

### `refresh_project_cache`

Refreshes the cached project for a long-running MCP session.

Input:

```json
{
  "projectPath": "C:/absolute/path/to/react-project"
}
```

Output:

```json
{
  "projectPath": "C:/absolute/path/to/react-project",
  "tsconfigPath": "C:/absolute/path/to/react-project/tsconfig.json",
  "sourceFileCount": 24,
  "cacheSize": 1,
  "refreshed": true
}
```

This tool does not change scan filters. `include`, `exclude`, and
`componentWrappers` remain options of the subsequent scan tool call.

## Detection Rules

A component is currently detected when it has an uppercase component name or an
anonymous default export name derived from the file path, and it matches one of
these patterns:

- function declaration or variable function with JSX;
- class declaration with JSX in `render()`;
- built-in or configured wrapper call around a JSX function;
- `lazy` or `React.lazy` declaration;
- styled factory declaration.

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
export class Panel extends React.Component<PanelProps> {
  render() {
    return <section>{this.props.title}</section>;
  }
}
```

```tsx
export default ({ title = "Untitled" }: PanelProps) => {
  return <section>{title}</section>;
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
export const Input = memo(forwardRef((props: InputProps, ref) => {
  return <input ref={ref} value={props.value} />;
}));
```

```tsx
export const Input = React.memo(React.forwardRef((props: InputProps, ref) => {
  return <input ref={ref} value={props.value} />;
}));
```

```tsx
export const LazyPanel = lazy(() => import("./Panel"));
```

```tsx
export const LazyNamedPanel = lazy(() =>
  import("./Panel").then(module => ({
    default: module.Panel,
  }))
);
```

```tsx
export const StyledPanel = styled.section`
  display: block;
`;
```

The scanner recognizes these component wrappers when JSX is inside the wrapped
function:

- `memo`
- `React.memo`
- `forwardRef`
- `React.forwardRef`

Wrappers can be nested, for example `memo(forwardRef(...))` and
`React.memo(React.forwardRef(...))`. Add arbitrary HOC names through
`componentWrappers`, for example `observer`, `mobx.observer`, `connect`, or
`withFeatureFlag`.

Props extraction supports typed props parameters, object destructuring defaults,
class generic props, `React.FC<Props>`, `FC<Props>`, and
`forwardRef<Ref, Props>`.

## Usage Rules

Usages are counted only when a component reference appears inside:

- `JsxOpeningElement`, for example `<Button></Button>`
- `JsxSelfClosingElement`, for example `<Button />`

The JSX usage tools intentionally ignore imports, exports, type references,
arrays, and other non-JSX references.

`find_unused_components` additionally reports known non-JSX runtime references
without adding them to `usageCount` or `usedIn`. Reference kind values:

- `react_create_element`: `React.createElement(Component)` or `createElement(Component)`
- `value_reference`: JSX prop values, arrays, objects, or assignments containing a component value
- `route_config_reference`: route/config object properties such as `component`, `Component`, or `element`
- `dynamic_reference`: component values passed into non-React calls
- `lazy_import`: dependency graph lazy import references

Usage resolution follows TypeScript symbols where possible, so alias imports and barrel exports are supported when the target project's `tsconfig.json` can resolve them.

Dependency and dependent resolution uses the same TypeScript symbol resolution. Components with the same local name in different files are treated as separate graph nodes when their JSX tags resolve to different declarations.

Dependency and dependent graphs also include lazy import edges from the lazy
wrapper component to the imported component target. Lazy import targets are
resolved through the target project's `tsconfig.json`; default exports, named
exports from `.then(...)`, barrels, re-exports, and path aliases are resolved
where TypeScript can resolve them. If no explicit export is found, the scanner
falls back to the only component in the imported source file.

## Testing

The test suite uses a mock React project in `tests/fixtures/react-project`.

Covered cases:

- props and JSDoc extraction
- declaration locations
- JSX usage tracking
- ignored non-JSX references
- non-JSX reference metadata for `find_unused_components`
- alias imports and barrel exports
- re-export chains
- same-name components in dependency graphs
- lazy import dependency edges
- class components, anonymous default exports, and styled factories
- `memo`, `React.memo`, `forwardRef`, `React.forwardRef`, `lazy`, and configured wrappers
- `React.FC`, `FC`, generic props, destructuring defaults, and `forwardRef<Ref, Props>`
- unused component risk
- component dependencies and dependents
- compact component reports and bounded dependency graphs
- `include`, `exclude`, and `componentWrappers` scan filters/options
- broad response pagination, `summary`/`full` modes, and field filtering
- cache refresh for added/deleted files and bounded project cache growth

Run:

```bash
npm test
```

## Known Limitations

- Higher-order components are recognized only when their callee is built in or passed through `componentWrappers`.
- Styled factories are detected syntactically; deep styled-components type metadata is not expanded.
- Component lookup by `componentName` returns the first exact case-insensitive name match when multiple components share the same name.
- Usage scanning excludes JSX usages inside the component's own declaration file.
- Non-JSX reference kinds are heuristic; renamed `createElement` helpers or custom router APIs may fall back to `value_reference`.
- `mode: "full"` with a large `limit` can return large `usedIn` arrays; prefer `summary`, `get_component_report`, or explicit pagination for broad scans.
- Results depend on the target project's `tsconfig.json`.
- The cache always uses `<projectPath>/tsconfig.json`; custom tsconfig paths are not supported.

## Related

- [README](../README.md)
- [Roadmap](ROADMAP.md)
