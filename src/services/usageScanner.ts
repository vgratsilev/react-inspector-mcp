import { Node, Symbol } from "ts-morph";
import path from "node:path";

import {
    ComponentUsage,
    ComponentUsageLocation,
    InternalComponentInfo,
} from "../types/ComponentInfo.js";
import type { ScanOptions } from "../types/ScanOptions.js";
import { shouldIncludeFile } from "./pathMatcher.js";

function resolveAliasedSymbol(symbol: Symbol): Symbol {
    let current = symbol;

    for (let index = 0; index < 10; index++) {
        const aliased = current.getAliasedSymbol();

        if (!aliased) {
            return current;
        }

        current = aliased;
    }

    return current;
}

function isComponentDeclaration(
    declaration: Node,
    component: InternalComponentInfo
): boolean {
    if (declaration === component.node) {
        return true;
    }

    if (declaration.getSourceFile().getFilePath() !== component.path) {
        return false;
    }

    return (
        declaration.getStart() >= component.node.getStart() &&
        declaration.getEnd() <= component.node.getEnd()
    );
}

function tagResolvesToComponent(
    tagNameNode: Node,
    component: InternalComponentInfo
): boolean {
    const symbol = tagNameNode.getSymbol();

    if (!symbol) {
        return tagNameNode.getText() === component.name;
    }

    const resolvedSymbol = resolveAliasedSymbol(symbol);

    return resolvedSymbol
        .getDeclarations()
        .some(declaration =>
            isComponentDeclaration(declaration, component)
        );
}

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
    includeDeclarationFile = false
): Promise<ComponentUsage> {
    const normalizedProjectPath = path.resolve(projectPath);
    const componentFile = component.node
        .getSourceFile()
        .getFilePath();
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

            if (!tagResolvesToComponent(tagNameNode, component)) {
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
