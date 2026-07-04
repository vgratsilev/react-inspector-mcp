import { Node } from "ts-morph";

import { getComponentKey } from "./componentResolver.js";
import type { ComponentResolver } from "./componentResolver.js";
import { getLazyImportReference } from "./lazyImportUtils.js";
import {
    ComponentDependency,
    ComponentUsageLocation,
    InternalComponentInfo,
} from "../types/ComponentInfo.js";

export type InternalComponentDependency = ComponentDependency & {
    componentKey: string;
};

export type DependencyMap = Map<
    string,
    InternalComponentDependency[]
>;

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
    const implementationNode = component.implementationNode;
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

export function buildDependencyMap(
    components: InternalComponentInfo[],
    resolver: ComponentResolver
): DependencyMap {
    const dependenciesByComponent: DependencyMap = new Map();

    for (const component of components) {
        dependenciesByComponent.set(
            getComponentKey(component),
            getDependenciesInsideComponent(component, resolver)
        );
    }

    return dependenciesByComponent;
}
