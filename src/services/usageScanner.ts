import { Node } from "ts-morph";
import path from "node:path";

import {
    ComponentUsage,
    ComponentUsageLocation,
    InternalComponentInfo,
} from "../types/ComponentInfo.js";
import type { ScanOptions } from "../types/ScanOptions.js";
import { createComponentResolver } from "./componentResolver.js";
import { shouldIncludeFile } from "./pathMatcher.js";

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
    const key = `${filePath}:${line}:${column}`;

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
    const componentFile = component.node
        .getSourceFile()
        .getFilePath();
    const includeDeclarationFile =
        usageOptions.includeDeclarationFile ?? false;
    const resolver = createComponentResolver(
        usageOptions.components ?? [component]
    );
    const usages: ComponentUsageLocation[] = [];
    const seen = new Set<string>();

    for (const sourceFile of component.node.getProject().getSourceFiles()) {
        const filePath = sourceFile.getFilePath();

        if (!includeDeclarationFile && filePath === componentFile) {
            continue;
        }

        if (!shouldIncludeFile(normalizedProjectPath, filePath, options)) {
            continue;
        }

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

            if (resolver.resolveJsxTag(tagNameNode) !== component) {
                continue;
            }

            addUsage(usages, seen, jsxUsage);
        }
    }

    return {
        usageCount: usages.length,
        usedIn: usages,
    };
}
