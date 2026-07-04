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
    FullComponentInfo,
    InternalComponentInfo,
    UnusedComponentInfo,
    UnusedComponentRisk,
} from "../types/ComponentInfo.js";
import type { ScanOptions } from "../types/ScanOptions.js";

type PublicComponentInfo = ComponentInfo & Pick<
    FullComponentInfo,
    "description" | "exported" | "defaultExport"
>;

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

export async function searchComponents(
    projectPath: string,
    query: string,
    options: ScanOptions = {}
): Promise<FullComponentInfo[]> {

    const context = createScanContext(projectPath, options);
    const { components } = context;
    const matched = components.filter(component =>
        matchesQuery(component, query)
    );

    if (matched.length === 0) {
        return [];
    }

    const usageIndex = context.getUsageIndex();

    return matched.map(component => ({
        ...toPublicComponent(component),
        ...getComponentUsageFromIndex(component, usageIndex),
    }));
}

export async function listComponents(
    projectPath: string,
    options: ScanOptions = {}
): Promise<PublicComponentInfo[]> {
    const { components } = createScanContext(projectPath, options);

    return components.map(toPublicComponent);
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
