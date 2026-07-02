import { Node } from "ts-morph";

import { scanComponents } from "../services/componentScanner.js";
import { getComponentImplementationNode } from "../services/componentNodeUtils.js";
import {
    createComponentResolver,
    getComponentKey,
} from "../services/componentResolver.js";
import type { ComponentResolver } from "../services/componentResolver.js";
import { getLazyImportReference } from "../services/lazyImportUtils.js";
import { scanUsages } from "../services/usageScanner.js";
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
    UnusedComponentInfo,
    UnusedComponentRisk,
} from "../types/ComponentInfo.js";
import type { ScanOptions } from "../types/ScanOptions.js";

type PublicComponentInfo = ComponentInfo & Pick<
    FullComponentInfo,
    "description" | "exported" | "defaultExport"
>;

type InternalComponentDependency = ComponentDependency & {
    componentKey: string;
};

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

function createUsageLocation(
    usageNode: Node,
    kind: ComponentUsageLocation["kind"]
): ComponentUsageLocation {
    const sourceFile = usageNode.getSourceFile();
    const filePath = sourceFile.getFilePath();
    const { line, column } = sourceFile.getLineAndColumnAtPos(
        usageNode.getStart()
    );

    return {
        filePath,
        line,
        column,
        kind,
        text: usageNode.getText(),
    };
}

function getDependenciesInsideComponent(
    component: InternalComponentInfo,
    resolver: ComponentResolver
): InternalComponentDependency[] {
    const implementationNode = getComponentImplementationNode(component.node);
    const componentKey = getComponentKey(component);
    const dependenciesByKey = new Map<
        string,
        InternalComponentDependency
    >();
    const seen = new Set<string>();

    function addDependencyUsage(
        dependencyComponent: InternalComponentInfo,
        usageNode: Node,
        kind: ComponentUsageLocation["kind"]
    ): void {
        const dependencyKey = getComponentKey(dependencyComponent);

        if (dependencyKey === componentKey) {
            return;
        }

        const usage = createUsageLocation(usageNode, kind);
        const key = [
            dependencyKey,
            usage.filePath,
            usage.line,
            usage.column,
            usage.kind,
        ].join(":");

        if (seen.has(key)) {
            return;
        }

        seen.add(key);

        const dependency = dependenciesByKey.get(dependencyKey) ?? {
            componentKey: dependencyKey,
            name: dependencyComponent.name,
            path: dependencyComponent.path,
            usages: [],
        };

        dependency.usages.push(usage);
        dependenciesByKey.set(dependencyKey, dependency);
    }

    for (const jsxUsage of implementationNode.getDescendants()) {
        if (
            !Node.isJsxOpeningElement(jsxUsage) &&
            !Node.isJsxSelfClosingElement(jsxUsage)
        ) {
            continue;
        }

        const tagName = jsxUsage.getTagNameNode().getText();

        if (!/^[A-Z]/.test(tagName)) {
            continue;
        }

        const dependencyComponent = resolver.resolveJsxTag(
            jsxUsage.getTagNameNode()
        );

        if (!dependencyComponent) {
            continue;
        }

        addDependencyUsage(dependencyComponent, jsxUsage, "jsx");
    }

    const lazyImport = getLazyImportReference(component.node);

    if (lazyImport) {
        const dependencyComponent = resolver.resolveLazyImport(
            component.node.getSourceFile(),
            lazyImport.moduleSpecifier,
            lazyImport.exportName
        );

        if (dependencyComponent) {
            addDependencyUsage(
                dependencyComponent,
                lazyImport.lazyCall,
                "lazy_import"
            );
        }
    }

    return [...dependenciesByKey.values()];
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

function buildDependencyMap(
    components: InternalComponentInfo[]
): Map<string, InternalComponentDependency[]> {
    const dependenciesByComponent = new Map<
        string,
        InternalComponentDependency[]
    >();
    const resolver = createComponentResolver(components);

    for (const component of components) {
        dependenciesByComponent.set(
            getComponentKey(component),
            getDependenciesInsideComponent(component, resolver)
        );
    }

    return dependenciesByComponent;
}

export async function searchComponents(
    projectPath: string,
    query: string,
    options: ScanOptions = {}
): Promise<FullComponentInfo[]> {

    const components = await scanComponents(projectPath, options);
    const matched = components.filter(component =>
        matchesQuery(component, query)
    );
    const result: FullComponentInfo[] = [];

    for (const component of matched) {
        result.push({
            ...toPublicComponent(component),
            ...(await scanUsages(component, projectPath, options, {
                components,
            })),
        });
    }

    return result;
}

export async function listComponents(
    projectPath: string,
    options: ScanOptions = {}
): Promise<PublicComponentInfo[]> {
    const components = await scanComponents(projectPath, options);

    return components.map(toPublicComponent);
}

export async function getComponent(
    projectPath: string,
    componentName: string,
    includeUsages = true,
    options: ScanOptions = {}
): Promise<FullComponentInfo | ComponentNotFound> {
    const components = await scanComponents(projectPath, options);
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
        ...(await scanUsages(component, projectPath, options, {
            components,
        })),
    };
}

export async function findComponentUsages(
    projectPath: string,
    componentName: string,
    options: ScanOptions = {}
): Promise<ComponentUsage | ComponentNotFound> {
    const components = await scanComponents(projectPath, options);
    const component = getComponentByName(components, componentName);

    if (!component) {
        return componentNotFound(componentName);
    }

    return scanUsages(component, projectPath, options, { components });
}

export async function findUnusedComponents(
    projectPath: string,
    options: ScanOptions = {}
): Promise<UnusedComponentInfo[]> {
    const components = await scanComponents(projectPath, options);
    const result: UnusedComponentInfo[] = [];

    for (const component of components) {
        const usage = await scanUsages(component, projectPath, options, {
            components,
        });

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
    const components = await scanComponents(projectPath, options);
    const component = getComponentByName(components, componentName);

    if (!component) {
        return componentNotFound(componentName);
    }

    return {
        componentName: component.name,
        dependencies: (
            buildDependencyMap(components).get(getComponentKey(component)) ??
            []
        ).map(toPublicDependency),
    };
}

export async function getComponentDependents(
    projectPath: string,
    componentName: string,
    options: ScanOptions = {}
): Promise<ComponentDependents | ComponentNotFound> {
    const components = await scanComponents(projectPath, options);
    const component = getComponentByName(components, componentName);

    if (!component) {
        return componentNotFound(componentName);
    }

    const dependencyMap = buildDependencyMap(components);
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
