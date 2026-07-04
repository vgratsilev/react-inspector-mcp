import { getComponentKey } from "../services/componentResolver.js";
import type {
    InternalComponentDependency,
} from "../services/dependencyScanner.js";
import {
    getComponentReferencesFromIndex,
} from "../services/componentReferenceScanner.js";
import { createScanContext } from "../services/scanContext.js";
import { getComponentUsageFromIndex } from "../services/usageScanner.js";
import {
    ComponentDependencies,
    ComponentDependents,
    ComponentDependency,
    ComponentInfo,
    ComponentKind,
    ComponentNotFound,
    ComponentReport,
    ComponentReportDependency,
    ComponentReportLocation,
    ComponentReportOptions,
    ComponentReportPropSummary,
    ComponentReportRisk,
    ComponentReferenceKind,
    ComponentReferenceLocation,
    ComponentUsage,
    ComponentUsageLocation,
    DEFAULT_DEPENDENCY_GRAPH_MAX_NODES,
    DEFAULT_REPORT_LOCATION_LIMIT,
    DependencyGraph,
    DependencyGraphDirection,
    DependencyGraphEdge,
    DependencyGraphNode,
    DependencyGraphOptions,
    FullComponentInfo,
    InternalComponentInfo,
    MAX_DEPENDENCY_GRAPH_DEPTH,
    PropInfo,
    SourceLocation,
    UnusedComponentConfidence,
    UnusedComponentInfo,
    UnusedComponentReason,
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
    | ComponentKind
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

type ComponentReportToolOptions = ScanOptions & ComponentReportOptions;

type DependencyGraphToolOptions = ScanOptions & DependencyGraphOptions;

type ComponentUsageOwner = {
    name: string;
    path: string;
    usages: ComponentUsageLocation[];
};

type DependentDependency = {
    dependentKey: string;
    dependency: InternalComponentDependency;
};

type GraphQueueItem = {
    component: InternalComponentInfo;
    depth: number;
};

const listSummaryFields = [
    "name",
    "kind",
    "path",
    "props",
    "description",
    "exported",
    "defaultExport",
] as const satisfies readonly ComponentOutputField[];

const listFullFields = [
    "name",
    "kind",
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
        kind: component.kind,
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
        kind: component.kind,
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

function getUnusedConfidence(
    component: InternalComponentInfo,
    references: ComponentReferenceLocation[]
): UnusedComponentConfidence {
    if (references.length > 0) {
        return "low";
    }

    if (!component.exported && !component.defaultExport) {
        return "high";
    }

    if (component.defaultExport) {
        return "low";
    }

    return "medium";
}

function getUnusedReason(
    references: ComponentReferenceLocation[]
): UnusedComponentReason {
    if (references.length > 0) {
        return "no_external_jsx_usages_but_has_known_references";
    }

    return "no_known_external_usages";
}

function getUsageKinds(
    references: ComponentReferenceLocation[]
): ComponentReferenceKind[] {
    const usageKinds: ComponentReferenceKind[] = [];
    const seen = new Set<ComponentReferenceKind>();

    for (const reference of references) {
        if (seen.has(reference.kind)) {
            continue;
        }

        usageKinds.push(reference.kind);
        seen.add(reference.kind);
    }

    return usageKinds;
}

function getLazyImportReferences(
    component: InternalComponentInfo,
    dependenciesByComponent: Map<string, InternalComponentDependency[]>
): ComponentReferenceLocation[] {
    const componentKey = getComponentKey(component);
    const references: ComponentReferenceLocation[] = [];

    for (const dependencies of dependenciesByComponent.values()) {
        for (const dependency of dependencies) {
            if (dependency.componentKey !== componentKey) {
                continue;
            }

            for (const usage of dependency.usages) {
                if (usage.kind !== "lazy_import") {
                    continue;
                }

                references.push({
                    ...usage,
                    kind: "lazy_import",
                });
            }
        }
    }

    return references;
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

function getBoundedInteger(
    value: number | undefined,
    fallback: number,
    minimum: number,
    maximum = Number.MAX_SAFE_INTEGER
): number {
    if (value === undefined || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.min(Math.max(Math.trunc(value), minimum), maximum);
}

function toReportComponent(
    component: InternalComponentInfo
): ComponentReport["component"] {
    return {
        name: component.name,
        kind: component.kind,
        path: component.path,
        declaration: component.declaration,
        description: component.description,
        exported: component.exported,
        defaultExport: component.defaultExport,
    };
}

function toReportProps(
    props: PropInfo[]
): ComponentReportPropSummary[] {
    return props.map(prop => ({
        name: prop.name,
        optional: prop.optional,
        defaultValue: prop.defaultValue,
    }));
}

function toReportLocation(
    location: ComponentUsageLocation | ComponentReferenceLocation,
    includeSourceText: boolean
): ComponentReportLocation {
    const baseLocation = {
        filePath: location.filePath,
        line: location.line,
        column: location.column,
        kind: location.kind,
    };

    if (!includeSourceText) {
        return baseLocation;
    }

    return {
        ...baseLocation,
        text: location.text,
    };
}

function toLimitedReportLocations(
    locations: Array<ComponentUsageLocation | ComponentReferenceLocation>,
    limit: number,
    includeSourceText: boolean
): ComponentReportLocation[] {
    return locations
        .slice(0, limit)
        .map(location => toReportLocation(location, includeSourceText));
}

function getReportLocationLimit(options: ComponentReportOptions): number {
    return getBoundedInteger(
        options.locationLimit,
        DEFAULT_REPORT_LOCATION_LIMIT,
        0
    );
}

function getGraphDepth(options: DependencyGraphOptions): number {
    return getBoundedInteger(
        options.depth,
        1,
        0,
        MAX_DEPENDENCY_GRAPH_DEPTH
    );
}

function getGraphMaxNodes(options: DependencyGraphOptions): number {
    return getBoundedInteger(
        options.maxNodes,
        DEFAULT_DEPENDENCY_GRAPH_MAX_NODES,
        1
    );
}

function getUniqueKinds<TKind extends string>(
    locations: Array<{ kind: TKind }>
): TKind[] {
    const kinds: TKind[] = [];
    const seen = new Set<TKind>();

    for (const location of locations) {
        if (seen.has(location.kind)) {
            continue;
        }

        kinds.push(location.kind);
        seen.add(location.kind);
    }

    return kinds;
}

function toReportDependency(
    owner: ComponentUsageOwner,
    limit: number,
    includeSourceText: boolean
): ComponentReportDependency {
    return {
        name: owner.name,
        path: owner.path,
        usageCount: owner.usages.length,
        returned: Math.min(owner.usages.length, limit),
        usages: toLimitedReportLocations(
            owner.usages,
            limit,
            includeSourceText
        ),
    };
}

function getComponentsByKey(
    components: InternalComponentInfo[]
): Map<string, InternalComponentInfo> {
    return new Map(
        components.map(component => [
            getComponentKey(component),
            component,
        ])
    );
}

function getDependentsForComponent(
    component: InternalComponentInfo,
    componentsByKey: Map<string, InternalComponentInfo>,
    dependencyMap: Map<string, InternalComponentDependency[]>
): ComponentUsageOwner[] {
    const componentKey = getComponentKey(component);

    return [...dependencyMap.entries()]
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
}

function getReportRisk(
    component: InternalComponentInfo,
    usage: ComponentUsage,
    references: ComponentReferenceLocation[],
    limit: number,
    includeSourceText: boolean
): ComponentReportRisk {
    if (usage.usageCount > 0) {
        return {
            candidate: false,
            confidence: null,
            reason: "has_external_jsx_usages",
            usageKinds: [],
            referenceCount: 0,
            returnedReferences: 0,
            references: [],
        };
    }

    const confidence = getUnusedConfidence(component, references);

    return {
        candidate: true,
        confidence,
        reason: getUnusedReason(references),
        usageKinds: getUsageKinds(references),
        referenceCount: references.length,
        returnedReferences: Math.min(references.length, limit),
        references: toLimitedReportLocations(
            references,
            limit,
            includeSourceText
        ),
    };
}

function getGraphNodeId(component: InternalComponentInfo): string {
    return `${component.path}#${component.name}`;
}

function toGraphNode(component: InternalComponentInfo): DependencyGraphNode {
    return {
        id: getGraphNodeId(component),
        name: component.name,
        kind: component.kind,
        path: component.path,
    };
}

function buildDependentsByComponent(
    dependencyMap: Map<string, InternalComponentDependency[]>
): Map<string, DependentDependency[]> {
    const dependentsByComponent = new Map<string, DependentDependency[]>();

    for (const [dependentKey, dependencies] of dependencyMap.entries()) {
        for (const dependency of dependencies) {
            const dependents = dependentsByComponent.get(
                dependency.componentKey
            ) ?? [];

            dependents.push({
                dependentKey,
                dependency,
            });
            dependentsByComponent.set(dependency.componentKey, dependents);
        }
    }

    return dependentsByComponent;
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
    const referenceIndex = context.getReferenceIndex();
    const dependencyMap = context.getDependencyMap();
    const result: UnusedComponentInfo[] = [];

    for (const component of components) {
        const usage = getComponentUsageFromIndex(component, usageIndex);

        if (usage.usageCount > 0) {
            continue;
        }

        const references = [
            ...getComponentReferencesFromIndex(component, referenceIndex),
            ...getLazyImportReferences(component, dependencyMap),
        ];
        const confidence = getUnusedConfidence(component, references);

        result.push({
            ...toPublicComponent(component),
            ...usage,
            reason: getUnusedReason(references),
            usageKinds: getUsageKinds(references),
            references,
            confidence,
            risk: confidence,
        });
    }

    return result;
}

export async function getComponentReport(
    projectPath: string,
    componentName: string,
    options: ComponentReportToolOptions = {}
): Promise<ComponentReport | ComponentNotFound> {
    const context = createScanContext(projectPath, options);
    const { components } = context;
    const component = getComponentByName(components, componentName);

    if (!component) {
        return componentNotFound(componentName);
    }

    const limit = getReportLocationLimit(options);
    const includeSourceText = options.includeSourceText ?? false;
    const usage = getComponentUsageFromIndex(
        component,
        context.getUsageIndex()
    );
    const dependencyMap = context.getDependencyMap();
    const dependencies = dependencyMap.get(getComponentKey(component)) ?? [];
    const componentsByKey = getComponentsByKey(components);
    const dependents = getDependentsForComponent(
        component,
        componentsByKey,
        dependencyMap
    );
    const references = usage.usageCount === 0
        ? [
            ...getComponentReferencesFromIndex(
                component,
                context.getReferenceIndex()
            ),
            ...getLazyImportReferences(component, dependencyMap),
        ]
        : [];

    return {
        component: toReportComponent(component),
        propsSummary: toReportProps(component.props),
        usages: {
            usageCount: usage.usageCount,
            returned: Math.min(usage.usedIn.length, limit),
            locations: toLimitedReportLocations(
                usage.usedIn,
                limit,
                includeSourceText
            ),
        },
        dependencies: dependencies.map(dependency =>
            toReportDependency(dependency, limit, includeSourceText)
        ),
        dependents: dependents.map(dependent =>
            toReportDependency(dependent, limit, includeSourceText)
        ),
        risk: getReportRisk(
            component,
            usage,
            references,
            limit,
            includeSourceText
        ),
    };
}

export async function getDependencyGraph(
    projectPath: string,
    componentName: string,
    options: DependencyGraphToolOptions = {}
): Promise<DependencyGraph | ComponentNotFound> {
    const context = createScanContext(projectPath, options);
    const { components } = context;
    const component = getComponentByName(components, componentName);

    if (!component) {
        return componentNotFound(componentName);
    }

    const direction = options.direction ?? "both";
    const depth = getGraphDepth(options);
    const maxNodes = getGraphMaxNodes(options);
    const dependencyMap = context.getDependencyMap();
    const componentsByKey = getComponentsByKey(components);
    const dependentsByComponent = buildDependentsByComponent(dependencyMap);
    const nodes = new Map<string, DependencyGraphNode>();
    const includedKeys = new Set<string>();
    const visitedDepthByKey = new Map<string, number>();
    const edgeIds = new Set<string>();
    const edges: DependencyGraphEdge[] = [];
    const queue: GraphQueueItem[] = [{ component, depth: 0 }];
    let truncated = false;

    function addNode(candidate: InternalComponentInfo): boolean {
        const key = getComponentKey(candidate);

        if (includedKeys.has(key)) {
            return true;
        }

        if (includedKeys.size >= maxNodes) {
            truncated = true;
            return false;
        }

        includedKeys.add(key);
        nodes.set(getGraphNodeId(candidate), toGraphNode(candidate));

        return true;
    }

    function enqueue(candidate: InternalComponentInfo, nextDepth: number): void {
        const key = getComponentKey(candidate);
        const visitedDepth = visitedDepthByKey.get(key);

        if (visitedDepth !== undefined && visitedDepth <= nextDepth) {
            return;
        }

        visitedDepthByKey.set(key, nextDepth);
        queue.push({
            component: candidate,
            depth: nextDepth,
        });
    }

    function addEdge(
        from: InternalComponentInfo,
        to: InternalComponentInfo,
        usages: ComponentUsageLocation[]
    ): void {
        const fromId = getGraphNodeId(from);
        const toId = getGraphNodeId(to);
        const edgeId = `${fromId}->${toId}`;

        if (edgeIds.has(edgeId)) {
            return;
        }

        edgeIds.add(edgeId);
        edges.push({
            from: fromId,
            to: toId,
            usageCount: usages.length,
            returned: Math.min(
                usages.length,
                DEFAULT_REPORT_LOCATION_LIMIT
            ),
            usageKinds: getUniqueKinds(usages),
            usages: toLimitedReportLocations(
                usages,
                DEFAULT_REPORT_LOCATION_LIMIT,
                false
            ),
        });
    }

    addNode(component);
    visitedDepthByKey.set(getComponentKey(component), 0);

    for (let index = 0; index < queue.length; index++) {
        const current = queue[index];

        if (!current || current.depth >= depth) {
            continue;
        }

        const currentKey = getComponentKey(current.component);
        const nextDepth = current.depth + 1;

        if (direction === "dependencies" || direction === "both") {
            for (const dependency of dependencyMap.get(currentKey) ?? []) {
                const dependencyComponent = componentsByKey.get(
                    dependency.componentKey
                );

                if (!dependencyComponent || !addNode(dependencyComponent)) {
                    continue;
                }

                addEdge(
                    current.component,
                    dependencyComponent,
                    dependency.usages
                );
                enqueue(dependencyComponent, nextDepth);
            }
        }

        if (direction === "dependents" || direction === "both") {
            for (const dependent of dependentsByComponent.get(currentKey) ?? []) {
                const dependentComponent = componentsByKey.get(
                    dependent.dependentKey
                );

                if (!dependentComponent || !addNode(dependentComponent)) {
                    continue;
                }

                addEdge(
                    dependentComponent,
                    current.component,
                    dependent.dependency.usages
                );
                enqueue(dependentComponent, nextDepth);
            }
        }
    }

    return {
        root: getGraphNodeId(component),
        nodes: [...nodes.values()],
        edges,
        depth,
        direction,
        truncated,
    };
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
    const componentsByKey = getComponentsByKey(components);
    const dependents = getDependentsForComponent(
        component,
        componentsByKey,
        dependencyMap
    );

    return {
        componentName: component.name,
        dependents,
    };
}
