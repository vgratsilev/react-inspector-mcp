#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
    findComponentUsages,
    findUnusedComponents,
    getComponent,
    getComponentDependencies,
    getComponentDependents,
    getComponentReport,
    getDependencyGraph,
    listComponents,
    searchComponents,
} from "./tools/searchComponents.js";
import { refreshProjectCache } from "./services/projectManager.js";
import {
    DEFAULT_DEPENDENCY_GRAPH_MAX_NODES,
    DEFAULT_REPORT_LOCATION_LIMIT,
    MAX_DEPENDENCY_GRAPH_DEPTH,
    dependencyGraphDirections,
} from "./types/ComponentInfo.js";
import {
    componentOutputFields,
    componentOutputModes,
    DEFAULT_OUTPUT_LIMIT,
} from "./types/ComponentOutput.js";

const packageMetadataSchema = z.object({
    version: z.string().trim().min(1),
});

const scanOptionsSchema = z.object({
    include: z.array(z.string().trim().min(1)).optional(),
    exclude: z.array(z.string().trim().min(1)).optional(),
    componentWrappers: z.array(z.string().trim().min(1)).optional(),
});

const outputOptionsSchema = z.object({
    limit: z.number().int().positive().default(DEFAULT_OUTPUT_LIMIT),
    offset: z.number().int().nonnegative().default(0),
    mode: z.enum(componentOutputModes).default("summary"),
    fields: z.array(z.enum(componentOutputFields)).min(1).optional(),
});

const projectPathSchema = scanOptionsSchema.extend({
    projectPath: z.string().trim().min(1),
});

const broadToolSchema = projectPathSchema.merge(outputOptionsSchema);

const searchComponentsSchema = broadToolSchema.extend({
    query: z.string().trim().default(""),
});

const componentNameSchema = projectPathSchema.extend({
    componentName: z.string().trim().min(1),
});

const getComponentSchema = componentNameSchema.extend({
    includeUsages: z.boolean().default(true),
});

const componentReportSchema = componentNameSchema.extend({
    locationLimit: z.number()
        .int()
        .nonnegative()
        .default(DEFAULT_REPORT_LOCATION_LIMIT),
    includeSourceText: z.boolean().default(false),
});

const dependencyGraphSchema = componentNameSchema.extend({
    direction: z.enum(dependencyGraphDirections).default("both"),
    depth: z.number()
        .int()
        .min(0)
        .max(MAX_DEPENDENCY_GRAPH_DEPTH)
        .default(1),
    maxNodes: z.number()
        .int()
        .positive()
        .default(DEFAULT_DEPENDENCY_GRAPH_MAX_NODES),
});

const scanOptionsInputSchema = {
    include: {
        type: "array",
        items: { type: "string" },
        description:
            "Optional glob patterns relative to project root, for example ['src/**/*.tsx']",
    },
    exclude: {
        type: "array",
        items: { type: "string" },
        description:
            "Optional glob patterns relative to project root, for example ['**/*.test.tsx']",
    },
    componentWrappers: {
        type: "array",
        items: { type: "string" },
        description:
            "Optional component wrapper callees, for example ['observer', 'mobx.observer', 'connect']",
    },
};

const projectPathInputSchema = {
    projectPath: {
        type: "string",
        description: "Absolute path to project root",
    },
    ...scanOptionsInputSchema,
};

const outputOptionsInputSchema = {
    limit: {
        type: "integer",
        minimum: 1,
        default: DEFAULT_OUTPUT_LIMIT,
        description: "Maximum number of components to return.",
    },
    offset: {
        type: "integer",
        minimum: 0,
        default: 0,
        description: "Zero-based offset for paginated component results.",
    },
    mode: {
        type: "string",
        enum: [...componentOutputModes],
        default: "summary",
        description:
            "summary returns compact props; full returns full component fields.",
    },
    fields: {
        type: "array",
        items: {
            type: "string",
            enum: [...componentOutputFields],
        },
        description:
            "Optional top-level fields to include in each returned component.",
    },
};

const broadToolInputSchema = {
    ...projectPathInputSchema,
    ...outputOptionsInputSchema,
};

const componentNameInputSchema = {
    ...projectPathInputSchema,
    componentName: {
        type: "string",
        description: "Exact component name",
    },
};

function formatError(error: unknown): string {
    if (error instanceof z.ZodError) {
        return JSON.stringify(
            {
                error: "Invalid tool arguments",
                issues: error.issues.map(issue => ({
                    path: issue.path.join("."),
                    message: issue.message,
                })),
            },
            null,
            2
        );
    }

    if (error instanceof Error) {
        return JSON.stringify(
            {
                error: error.message,
            },
            null,
            2
        );
    }

    return JSON.stringify(
        {
            error: "Unknown error",
        },
        null,
        2
    );
}

async function readPackageVersion(): Promise<string> {
    const packageJsonPath = join(
        dirname(fileURLToPath(import.meta.url)),
        "..",
        "package.json"
    );
    const packageJsonText = await readFile(packageJsonPath, "utf8");
    const packageJson: unknown = JSON.parse(packageJsonText);

    return packageMetadataSchema.parse(packageJson).version;
}

const packageVersion = await readPackageVersion();

const server = new Server(
    {
        name: "react-inspector-mcp",
        version: packageVersion,
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

server.setRequestHandler(
    ListToolsRequestSchema,
    async () => ({
        tools: [
            {
                name: "search_components",
                description:
                    "Search React components and return paginated props and usage metadata",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...broadToolInputSchema,
                        query: {
                            type: "string",
                            description:
                                "Component search query. Searches name, path, description, prop names and prop types.",
                        },
                    },
                    required: ["projectPath"],
                },
            },
            {
                name: "list_components",
                description:
                    "List React components with paginated props and metadata",
                inputSchema: {
                    type: "object",
                    properties: broadToolInputSchema,
                    required: ["projectPath"],
                },
            },
            {
                name: "get_component",
                description:
                    "Get one React component by exact name",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...componentNameInputSchema,
                        includeUsages: {
                            type: "boolean",
                            description:
                                "Whether to include JSX usage locations",
                            default: true,
                        },
                    },
                    required: ["projectPath", "componentName"],
                },
            },
            {
                name: "get_component_report",
                description:
                    "Get a compact agent-facing report for one React component",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...componentNameInputSchema,
                        locationLimit: {
                            type: "integer",
                            minimum: 0,
                            default: DEFAULT_REPORT_LOCATION_LIMIT,
                            description:
                                "Maximum usage/reference locations per section.",
                        },
                        includeSourceText: {
                            type: "boolean",
                            default: false,
                            description:
                                "Whether compact locations include source text snippets.",
                        },
                    },
                    required: ["projectPath", "componentName"],
                },
            },
            {
                name: "get_dependency_graph",
                description:
                    "Get a compact component dependency graph with bounded depth",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...componentNameInputSchema,
                        direction: {
                            type: "string",
                            enum: [...dependencyGraphDirections],
                            default: "both",
                            description:
                                "Graph direction from the root component.",
                        },
                        depth: {
                            type: "integer",
                            minimum: 0,
                            maximum: MAX_DEPENDENCY_GRAPH_DEPTH,
                            default: 1,
                            description:
                                "Maximum graph depth from the root component.",
                        },
                        maxNodes: {
                            type: "integer",
                            minimum: 1,
                            default: DEFAULT_DEPENDENCY_GRAPH_MAX_NODES,
                            description:
                                "Maximum graph nodes to return before truncating.",
                        },
                    },
                    required: ["projectPath", "componentName"],
                },
            },
            {
                name: "find_component_usages",
                description:
                    "Find JSX usage locations for one React component by exact name",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...componentNameInputSchema,
                    },
                    required: ["projectPath", "componentName"],
                },
            },
            {
                name: "find_unused_components",
                description:
                    "Find React components with no known external JSX usages and report confidence plus non-JSX references",
                inputSchema: {
                    type: "object",
                    properties: projectPathInputSchema,
                    required: ["projectPath"],
                },
            },
            {
                name: "get_component_dependencies",
                description:
                    "List components used inside one React component",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...componentNameInputSchema,
                    },
                    required: ["projectPath", "componentName"],
                },
            },
            {
                name: "get_component_dependents",
                description:
                    "List components that use one React component",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...componentNameInputSchema,
                    },
                    required: ["projectPath", "componentName"],
                },
            },
            {
                name: "refresh_project_cache",
                description:
                    "Refresh cached project source files for a long-running MCP session",
                inputSchema: {
                    type: "object",
                    properties: projectPathInputSchema,
                    required: ["projectPath"],
                },
            },
        ],
    })
);

server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => {
        const { name, arguments: args } = request.params;

        try {
            let result: unknown;

            if (name === "search_components") {
                const parsedArgs = searchComponentsSchema.parse(args);

                result = await searchComponents(
                    parsedArgs.projectPath,
                    parsedArgs.query,
                    parsedArgs
                );
            } else if (name === "list_components") {
                const parsedArgs = broadToolSchema.parse(args);

                result = await listComponents(
                    parsedArgs.projectPath,
                    parsedArgs
                );
            } else if (name === "get_component") {
                const parsedArgs = getComponentSchema.parse(args);

                result = await getComponent(
                    parsedArgs.projectPath,
                    parsedArgs.componentName,
                    parsedArgs.includeUsages,
                    parsedArgs
                );
            } else if (name === "get_component_report") {
                const parsedArgs = componentReportSchema.parse(args);

                result = await getComponentReport(
                    parsedArgs.projectPath,
                    parsedArgs.componentName,
                    parsedArgs
                );
            } else if (name === "get_dependency_graph") {
                const parsedArgs = dependencyGraphSchema.parse(args);

                result = await getDependencyGraph(
                    parsedArgs.projectPath,
                    parsedArgs.componentName,
                    parsedArgs
                );
            } else if (name === "find_component_usages") {
                const parsedArgs = componentNameSchema.parse(args);

                result = await findComponentUsages(
                    parsedArgs.projectPath,
                    parsedArgs.componentName,
                    parsedArgs
                );
            } else if (name === "find_unused_components") {
                const parsedArgs = projectPathSchema.parse(args);

                result = await findUnusedComponents(
                    parsedArgs.projectPath,
                    parsedArgs
                );
            } else if (name === "get_component_dependencies") {
                const parsedArgs = componentNameSchema.parse(args);

                result = await getComponentDependencies(
                    parsedArgs.projectPath,
                    parsedArgs.componentName,
                    parsedArgs
                );
            } else if (name === "get_component_dependents") {
                const parsedArgs = componentNameSchema.parse(args);

                result = await getComponentDependents(
                    parsedArgs.projectPath,
                    parsedArgs.componentName,
                    parsedArgs
                );
            } else if (name === "refresh_project_cache") {
                const parsedArgs = projectPathSchema.parse(args);

                result = refreshProjectCache(parsedArgs.projectPath);
            } else {
                throw new Error(`Unknown tool: ${name}`);
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        } catch (error) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: formatError(error),
                    },
                ],
            };
        }
    }
);

const transport = new StdioServerTransport();

await server.connect(transport);
