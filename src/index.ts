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
    listComponents,
    searchComponents,
} from "./tools/searchComponents.js";

const scanOptionsSchema = z.object({
    include: z.array(z.string().trim().min(1)).optional(),
    exclude: z.array(z.string().trim().min(1)).optional(),
});

const projectPathSchema = scanOptionsSchema.extend({
    projectPath: z.string().trim().min(1),
});

const searchComponentsSchema = projectPathSchema.extend({
    query: z.string().trim().default(""),
});

const componentNameSchema = projectPathSchema.extend({
    componentName: z.string().trim().min(1),
});

const getComponentSchema = componentNameSchema.extend({
    includeUsages: z.boolean().default(true),
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
};

const projectPathInputSchema = {
    projectPath: {
        type: "string",
        description: "Absolute path to project root",
    },
    ...scanOptionsInputSchema,
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

const server = new Server(
    {
        name: "react-project-mcp",
        version: "1.0.0",
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
                    "Search React components and return props and JSX usages",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...projectPathInputSchema,
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
                    "List React components with props and metadata",
                inputSchema: {
                    type: "object",
                    properties: projectPathInputSchema,
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
                        ...projectPathInputSchema,
                        componentName: {
                            type: "string",
                            description: "Exact component name",
                        },
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
                name: "find_component_usages",
                description:
                    "Find JSX usage locations for one React component by exact name",
                inputSchema: {
                    type: "object",
                    properties: {
                        ...projectPathInputSchema,
                        componentName: {
                            type: "string",
                            description: "Exact component name",
                        },
                    },
                    required: ["projectPath", "componentName"],
                },
            },
            {
                name: "find_unused_components",
                description:
                    "Find React components that have no JSX usages outside their declaration file",
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
                        ...projectPathInputSchema,
                        componentName: {
                            type: "string",
                            description: "Exact component name",
                        },
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
                        ...projectPathInputSchema,
                        componentName: {
                            type: "string",
                            description: "Exact component name",
                        },
                    },
                    required: ["projectPath", "componentName"],
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
                const parsedArgs = projectPathSchema.parse(args);

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
