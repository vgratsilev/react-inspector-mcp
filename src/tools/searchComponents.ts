import { getComponentKey } from "../services/componentResolver.js";
import type {
    InternalComponentDependency,
} from "../services/dependencyScanner.js";
import { createScanContext } from "../services/scanContext.js";
import { getComponentUsageFromIndex } from "../services/usageScanner.js";
import {
    ComponentDependencies,
    ComponentDependents,
    ComponentDependency,
    ComponentInfo,
    ComponentNotFound,
    ComponentUsage,
    ComponentUsageLocation,
    FullComponentInfo,
    InternalComponentInfo,
    PropInfo,
    SourceLocation,
    UnusedComponentInfo,
    UnusedComponentRisk,
} from "../types/ComponentInfo.js";
import {
    ComponentOutputField,
    ComponentOutputOptions,
    ComponentOutputMode,
    DEFAULT_OUTPUT_LIMIT,
    PaginatedResult,
} from "../types/ComponentOutput.js";
import type { ScanOptions } from "../types/ScanOptions.js";

type PublicComponentInfo = ComponentInfo & Pick<
    FullComponentInfo,
    "description" | "exported" | "defaultExport"
>;

type SummaryPropInfo = Pick<PropInfo, "name" | "optional">;

type SummaryComponentInfo = Omit<
    PublicComponentInfo,
    "declaration" | "props"
> & {
    props: SummaryPropInfo[];
};

type SearchSummaryComponentInfo = SummaryComponentInfo &
    Pick<ComponentUsage, "usageCount">;

type ComponentOutputValue =
    | string
    | boolean
    | number
    | SourceLocation
    | PropInfo[]
    | SummaryPropInfo[]
    | ComponentUsageLocation[]
    | undefined;

type ComponentOutputItem = Partial<
    Record<ComponentOutputField, ComponentOutputValue>
>;

type BroadToolOptions = ScanOptions & ComponentOutputOptions;

type BroadFullOptions = BroadToolOptions & {
    mode: "full";
    fields?: undefined;
};

type BroadSummaryOptions = BroadToolOptions & {
    mode?: "summary";
    fields?: undefined;
};

type BroadFieldOptions = BroadToolOptions & {
    fields: ComponentOutputField[];
};

const listSummaryFields = [
    "name",
    "path",
    "props",
    "description",
    "exported",
    "defaultExport",
] as const satisfies readonly ComponentOutputField[];

const listFullFields = [
    "name",
    "path",
    "declaration",
    "props",
    "description",
    "exported",
    "defaultExport",
] as const satisfies readonly ComponentOutputField[];

const searchSummaryFields = [
    ...listSummaryFields,
    "usageCount",
] as const satisfies readonly ComponentOutputField[];

const searchFullFields = [
    ...listFullFields,
    "usageCount",
    "usedIn",
] as const satisfies readonly ComponentOutputField[];

function toPublicComponent(
    component: InternalComponentInfo
): PublicComponentInfo {
    return {
        name: component.name,
        path: component.path,
        declaration: component.declaration,
        props: component.props,
        description: component.description,
        exported: component.exported,
        defaultExport: component.defaultExport,
    };
}

function toSummaryProps(props: PropInfo[]): SummaryPropInfo[] {
    return props.map(prop => ({
        name: prop.name,
        optional: prop.optional,
    }));
}

function toSummaryComponent(
    component: InternalComponentInfo
): SummaryComponentInfo {
    return {
        name: component.name,
        path: component.path,
        props: toSummaryProps(component.props),
        description: component.description,
        exported: component.exported,
        defaultExport: component.defaultExport,
    };
}

function toFullComponent(
    component: InternalComponentInfo
): PublicComponentInfo {
    return toPublicComponent(component);
}

function matchesQuery(
    component: InternalComponentInfo,
    query: string
): boolean {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
        return true;
    }

    const searchable = [
        component.name,
        component.path,
        component.description ?? "",
        ...component.props.map(prop => prop.name),
        ...component.props.map(prop => prop.type),
    ];

    return searchable.some(value =>
        value.toLowerCase().includes(normalizedQuery)
    );
}

function matchesName(
    component: InternalComponentInfo,
    componentName: string
): boolean {
    return component.name.toLowerCase() === componentName.toLowerCase();
}

function getUnusedRisk(
    component: InternalComponentInfo
): UnusedComponentRisk {
    if (!component.exported && !component.defaultExport) {
        return "high";
    }

    if (component.defaultExport) {
        return "low";
    }

    return "medium";
}

function getComponentByName(
    components: InternalComponentInfo[],
    componentName: string
): InternalComponentInfo | undefined {
    return components.find(candidate =>
        matchesName(candidate, componentName)
    );
}

function componentNotFound(componentName: string): ComponentNotFound {
    return {
        found: false,
        componentName,
        message: `Component "${componentName}" was not found in the scanned project.`,
    };
}

function toPublicDependency(
    dependency: InternalComponentDependency
): ComponentDependency {
    return {
        name: dependency.name,
        path: dependency.path,
        usages: dependency.usages,
    };
}

function getOutputMode(options: ComponentOutputOptions): ComponentOutputMode {
    return options.mode ?? "summary";
}

function getOutputFields(
    mode: ComponentOutputMode,
    options: ComponentOutputOptions,
    summaryFields: readonly ComponentOutputField[],
    fullFields: readonly ComponentOutputField[]
): readonly ComponentOutputField[] {
    return options.fields ?? (mode === "summary" ? summaryFields : fullFields);
}

function shouldIncludeUsage(
    mode: ComponentOutputMode,
    fields: readonly ComponentOutputField[]
): boolean {
    if (mode === "summary") {
        return fields.includes("usageCount");
    }

    return fields.includes("usageCount") || fields.includes("usedIn");
}

function projectOutputFields(
    item: ComponentOutputItem,
    fields: readonly ComponentOutputField[]
): ComponentOutputItem {
    const projected: ComponentOutputItem = {};

    for (const field of fields) {
        if (field in item) {
            projected[field] = item[field];
        }
    }

    return projected;
}

function paginate<TInput, TOutput>(
    values: TInput[],
    options: ComponentOutputOptions,
    mapItem: (item: TInput) => TOutput
): PaginatedResult<TOutput> {
    const limit = options.limit ?? DEFAULT_OUTPUT_LIMIT;
    const offset = options.offset ?? 0;
    const page = values.slice(offset, offset + limit);
    const nextOffset =
        offset + page.length < values.length
            ? offset + page.length
            : null;

    return {
        items: page.map(mapItem),
        total: values.length,
        returned: page.length,
        truncated: nextOffset !== null,
        nextOffset,
    };
}

export async function searchComponents(
    projectPath: string,
    query: string,
    options: BroadFieldOptions
): Promise<PaginatedResult<ComponentOutputItem>>;

export async function searchComponents(
    projectPath: string,
    query: string,
    options: BroadFullOptions
): Promise<PaginatedResult<FullComponentInfo>>;

export async function searchComponents(
    projectPath: string,
    query: string,
    options?: BroadSummaryOptions
): Promise<PaginatedResult<SearchSummaryComponentInfo>>;

export async function searchComponents(
    projectPath: string,
    query: string,
    options: BroadToolOptions
): Promise<
    PaginatedResult<
        ComponentOutputItem |
        FullComponentInfo |
        SearchSummaryComponentInfo
    >
>;

export async function searchComponents(
    projectPath: string,
    query: string,
    options: BroadToolOptions = {}
): Promise<
    PaginatedResult<
        ComponentOutputItem |
        FullComponentInfo |
        SearchSummaryComponentInfo
    >
> {

    const context = createScanContext(projectPath, options);
    const { components } = context;
    const matched = components.filter(component =>
        matchesQuery(component, query)
    );

    const mode = getOutputMode(options);
    const fields = getOutputFields(
        mode,
        options,
        searchSummaryFields,
        searchFullFields
    );
    const usageIndex = shouldIncludeUsage(mode, fields)
        ? context.getUsageIndex()
        : undefined;

    return paginate(matched, options, component => {
        const usage = usageIndex
            ? getComponentUsageFromIndex(component, usageIndex)
            : undefined;
        const item =
            mode === "summary"
                ? {
                    ...toSummaryComponent(component),
                    usageCount: usage?.usageCount ?? 0,
                }
                : {
                    ...toFullComponent(component),
                    ...(usage ?? {
                        usageCount: 0,
                        usedIn: [],
                    }),
                };

        return projectOutputFields(item, fields);
    });
}

export async function listComponents(
    projectPath: string,
    options: BroadFieldOptions
): Promise<PaginatedResult<ComponentOutputItem>>;

export async function listComponents(
    projectPath: string,
    options: BroadFullOptions
): Promise<PaginatedResult<PublicComponentInfo>>;

export async function listComponents(
    projectPath: string,
    options?: BroadSummaryOptions
): Promise<PaginatedResult<SummaryComponentInfo>>;

export async function listComponents(
    projectPath: string,
    options: BroadToolOptions
): Promise<
    PaginatedResult<
        ComponentOutputItem |
        PublicComponentInfo |
        SummaryComponentInfo
    >
>;

export async function listComponents(
    projectPath: string,
    options: BroadToolOptions = {}
): Promise<
    PaginatedResult<
        ComponentOutputItem |
        PublicComponentInfo |
        SummaryComponentInfo
    >
> {
    const { components } = createScanContext(projectPath, options);
    const mode = getOutputMode(options);
    const fields = getOutputFields(
        mode,
        options,
        listSummaryFields,
        listFullFields
    );

    return paginate(components, options, component => {
        const item =
            mode === "summary"
                ? toSummaryComponent(component)
                : toFullComponent(component);

        return projectOutputFields(item, fields);
    });
}

export async function getComponent(
    projectPath: string,
    componentName: string,
    includeUsages = true,
    options: ScanOptions = {}
): Promise<FullComponentInfo | ComponentNotFound> {
    const context = createScanContext(projectPath, options);
    const { components } = context;
    const component = getComponentByName(components, componentName);

    if (!component) {
        return componentNotFound(componentName);
    }

    const publicComponent = toPublicComponent(component);

    if (!includeUsages) {
        return {
            ...publicComponent,
            usageCount: 0,
            usedIn: [],
        };
    }

    return {
        ...publicComponent,
        ...getComponentUsageFromIndex(
            component,
            context.getUsageIndex()
        ),
    };
}

export async function findComponentUsages(
    projectPath: string,
    componentName: string,
    options: ScanOptions = {}
): Promise<ComponentUsage | ComponentNotFound> {
    const context = createScanContext(projectPath, options);
    const { components } = context;
    const component = getComponentByName(components, componentName);

    if (!component) {
        return componentNotFound(componentName);
    }

    return getComponentUsageFromIndex(component, context.getUsageIndex());
}

export async function findUnusedComponents(
    projectPath: string,
    options: ScanOptions = {}
): Promise<UnusedComponentInfo[]> {
    const context = createScanContext(projectPath, options);
    const { components } = context;
    const usageIndex = context.getUsageIndex();
    const result: UnusedComponentInfo[] = [];

    for (const component of components) {
        const usage = getComponentUsageFromIndex(component, usageIndex);

        if (usage.usageCount > 0) {
            continue;
        }

        result.push({
            ...toPublicComponent(component),
            ...usage,
            reason: "no_external_jsx_usages",
            risk: getUnusedRisk(component),
        });
    }

    return result;
}

export async function getComponentDependencies(
    projectPath: string,
    componentName: string,
    options: ScanOptions = {}
): Promise<ComponentDependencies | ComponentNotFound> {
    const context = createScanContext(projectPath, options);
    const { components } = context;
    const component = getComponentByName(components, componentName);

    if (!component) {
        return componentNotFound(componentName);
    }

    return {
        componentName: component.name,
        dependencies: (
            context.getDependencyMap().get(getComponentKey(component)) ??
            []
        ).map(toPublicDependency),
    };
}

export async function getComponentDependents(
    projectPath: string,
    componentName: string,
    options: ScanOptions = {}
): Promise<ComponentDependents | ComponentNotFound> {
    const context = createScanContext(projectPath, options);
    const { components } = context;
    const component = getComponentByName(components, componentName);

    if (!component) {
        return componentNotFound(componentName);
    }

    const dependencyMap = context.getDependencyMap();
    const componentKey = getComponentKey(component);
    const componentsByKey = new Map(
        components.map(candidate => [
            getComponentKey(candidate),
            candidate,
        ])
    );
    const dependents = [...dependencyMap.entries()]
        .filter(([dependentKey]) => dependentKey !== componentKey)
        .flatMap(([dependentKey, dependencies]) => {
            const dependency = dependencies.find(candidate =>
                candidate.componentKey === componentKey
            );
            const dependent = componentsByKey.get(dependentKey);

            if (!dependency || !dependent) {
                return [];
            }

            return [{
                name: dependent.name,
                path: dependent.path,
                usages: dependency.usages,
            }];
        });

    return {
        componentName: component.name,
        dependents,
    };
}
