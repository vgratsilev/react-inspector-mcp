import { Node } from "ts-morph";
import type { SourceFile } from "ts-morph";
import path from "node:path";

import {
    ComponentUsage,
    ComponentUsageLocation,
    InternalComponentInfo,
} from "../types/ComponentInfo.js";
import type { ScanOptions } from "../types/ScanOptions.js";
import {
    createComponentResolver,
    getComponentKey,
} from "./componentResolver.js";
import type { ComponentResolver } from "./componentResolver.js";
import { getProject } from "./projectManager.js";
import { shouldIncludeFile } from "./pathMatcher.js";

export type UsageIndex = Map<string, ComponentUsageLocation[]>;

function addUsage(
    usages: ComponentUsageLocation[],
    seen: Set<string>,
    jsxUsage: Node
): void {
    const sourceFile = jsxUsage.getSourceFile();
    const filePath = sourceFile.getFilePath();
    const { line, column } = sourceFile.getLineAndColumnAtPos(
        jsxUsage.getStart()
    );
    const key = `${filePath}:${line}:${column}:jsx`;

    if (seen.has(key)) {
        return;
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

export function getComponentUsageFromIndex(
    component: InternalComponentInfo,
    usageIndex: UsageIndex
): ComponentUsage {
    const usedIn = usageIndex.get(getComponentKey(component)) ?? [];

    return {
        usageCount: usedIn.length,
        usedIn,
    };
}

export function buildUsageIndex(
    sourceFiles: SourceFile[],
    components: InternalComponentInfo[],
    resolver: ComponentResolver,
    options: {
        includeDeclarationFile?: boolean;
    } = {}
): UsageIndex {
    const usageIndex: UsageIndex = new Map(
        components.map(component => [getComponentKey(component), []])
    );
    const seenByComponentKey = new Map<string, Set<string>>();
    const includeDeclarationFile =
        options.includeDeclarationFile ?? false;

    function getSeen(componentKey: string): Set<string> {
        const seen = seenByComponentKey.get(componentKey) ?? new Set();

        seenByComponentKey.set(componentKey, seen);

        return seen;
    }

    for (const sourceFile of sourceFiles) {
        const filePath = sourceFile.getFilePath();

        for (const jsxUsage of sourceFile.getDescendants()) {
            if (
                !Node.isJsxOpeningElement(jsxUsage) &&
                !Node.isJsxSelfClosingElement(jsxUsage)
            ) {
                continue;
            }

            const tagNameNode = jsxUsage.getTagNameNode();
            const tagName = tagNameNode.getText();

            if (!/^[A-Z]/.test(tagName)) {
                continue;
            }

            const component = resolver.resolveJsxTag(tagNameNode);

            if (!component) {
                continue;
            }

            if (!includeDeclarationFile && filePath === component.path) {
                continue;
            }

            const componentKey = getComponentKey(component);
            const usages = usageIndex.get(componentKey);

            if (!usages) {
                continue;
            }

            addUsage(usages, getSeen(componentKey), jsxUsage);
        }
    }

    return usageIndex;
}

export async function scanUsages(
    component: InternalComponentInfo,
    projectPath: string,
    options: ScanOptions = {},
    usageOptions: {
        includeDeclarationFile?: boolean;
        components?: InternalComponentInfo[];
    } = {}
): Promise<ComponentUsage> {
    const normalizedProjectPath = path.resolve(projectPath);
    const project = getProject(projectPath);
    const sourceFiles = project.getSourceFiles().filter(sourceFile =>
        shouldIncludeFile(
            normalizedProjectPath,
            sourceFile.getFilePath(),
            options
        )
    );
    const components = usageOptions.components ?? [component];
    const resolver = createComponentResolver(
        components
    );
    const usageIndex = buildUsageIndex(sourceFiles, components, resolver, {
        includeDeclarationFile: usageOptions.includeDeclarationFile,
    });

    return getComponentUsageFromIndex(component, usageIndex);
}
