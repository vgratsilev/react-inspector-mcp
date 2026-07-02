import { Node } from "ts-morph";

import { scanComponents } from "../services/componentScanner.js";
import { getComponentImplementationNode } from "../services/componentNodeUtils.js";
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

function getJsxUsagesInsideComponent(
    component: InternalComponentInfo
): ComponentUsageLocation[] {
    const implementationNode = getComponentImplementationNode(component.node);
    const usages: ComponentUsageLocation[] = [];
    const seen = new Set<string>();

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

        const sourceFile = jsxUsage.getSourceFile();
        const filePath = sourceFile.getFilePath();
        const { line, column } = sourceFile.getLineAndColumnAtPos(
            jsxUsage.getStart()
        );
        const key = `${filePath}:${line}:${column}`;

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);

        usages.push({
            filePath,
            line,
            column,
            kind: "jsx",
            text: jsxUsage.getText(),
        });
    }

    return usages;
}

function buildDependencyMap(
    components: InternalComponentInfo[]
): Map<string, ComponentDependency[]> {
    const componentsByName = new Map(
        components.map(component => [component.name, component])
    );
    const dependenciesByComponent = new Map<string, ComponentDependency[]>();

    for (const component of components) {
        const usages = getJsxUsagesInsideComponent(component);
        const dependenciesByName = new Map<string, ComponentDependency>();

        for (const usage of usages) {
            const match = usage.text.match(/^<\s*([A-Z][\w.]*)/);
            const dependencyName = match?.[1]?.split(".")[0];

            if (!dependencyName || dependencyName === component.name) {
                continue;
            }

            const dependencyComponent = componentsByName.get(dependencyName);

            if (!dependencyComponent) {
                continue;
            }

            const dependency = dependenciesByName.get(dependencyName) ?? {
                name: dependencyComponent.name,
                path: dependencyComponent.path,
                usages: [],
            };

            dependency.usages.push(usage);
            dependenciesByName.set(dependencyName, dependency);
        }

        dependenciesByComponent.set(
            component.name,
            [...dependenciesByName.values()]
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
            ...(await scanUsages(component, projectPath, options)),
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
        ...(await scanUsages(component, projectPath, options)),
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

    return scanUsages(component, projectPath, options);
}

export async function findUnusedComponents(
    projectPath: string,
    options: ScanOptions = {}
): Promise<UnusedComponentInfo[]> {
    const components = await scanComponents(projectPath, options);
    const result: UnusedComponentInfo[] = [];

    for (const component of components) {
        const usage = await scanUsages(component, projectPath, options);

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
        dependencies:
            buildDependencyMap(components).get(component.name) ?? [],
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
    const dependents = [...dependencyMap.entries()]
        .filter(([name]) => name !== component.name)
        .flatMap(([name, dependencies]) => {
            const dependency = dependencies.find(candidate =>
                candidate.name === component.name
            );
            const dependent = getComponentByName(components, name);

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
