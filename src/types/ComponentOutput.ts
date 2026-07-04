export const DEFAULT_OUTPUT_LIMIT = 20;

export const componentOutputModes = ["summary", "full"] as const;

export type ComponentOutputMode = (typeof componentOutputModes)[number];

export const componentOutputFields = [
    "name",
    "path",
    "declaration",
    "props",
    "description",
    "exported",
    "defaultExport",
    "usageCount",
    "usedIn",
] as const;

export type ComponentOutputField = (typeof componentOutputFields)[number];

export interface ComponentOutputOptions {
    limit?: number;
    offset?: number;
    mode?: ComponentOutputMode;
    fields?: ComponentOutputField[];
}

export interface PaginatedResult<TItem> {
    items: TItem[];
    total: number;
    returned: number;
    truncated: boolean;
    nextOffset: number | null;
}
