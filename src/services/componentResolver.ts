import path from "node:path";
import { Node, ts } from "ts-morph";
import type { SourceFile, Symbol } from "ts-morph";

import type { ComponentNode } from "../types/ComponentNode.js";
import type { InternalComponentInfo } from "../types/ComponentInfo.js";

const maxAliasResolutionDepth = 10;

export interface ComponentResolver {
    resolveJsxTag(tagNameNode: Node): InternalComponentInfo | undefined;
    resolveReference(referenceNode: Node): InternalComponentInfo | undefined;
    resolveLazyImport(
        sourceFile: SourceFile,
        moduleSpecifier: string,
        exportName?: string
    ): InternalComponentInfo | undefined;
}

function normalizeFilePath(filePath: string): string {
    return path.normalize(filePath);
}

function getNodeKey(node: Node): string {
    return `${normalizeFilePath(
        node.getSourceFile().getFilePath()
    )}:${node.getStart()}`;
}

export function getComponentKey(
    component: InternalComponentInfo
): string {
    return `${normalizeFilePath(component.path)}:${component.node.getStart()}`;
}

export function resolveAliasedSymbol(symbol: Symbol): Symbol {
    let current = symbol;

    for (let index = 0; index < maxAliasResolutionDepth; index++) {
        const aliased = current.getAliasedSymbol();

        if (!aliased) {
            return current;
        }

        current = aliased;
    }

    return current;
}

function getComponentNameNode(node: ComponentNode): Node | undefined {
    if (
        Node.isClassDeclaration(node) ||
        Node.isFunctionDeclaration(node)
    ) {
        return node.getNameNode();
    }

    if (Node.isVariableDeclaration(node)) {
        return node.getNameNode();
    }

    return undefined;
}

function getComponentSymbol(
    node: ComponentNode
): Symbol | undefined {
    const symbol = node.getSymbol();

    if (symbol) {
        return symbol;
    }

    return getComponentNameNode(node)?.getSymbol();
}

function addToMapList<TKey, TValue>(
    map: Map<TKey, TValue[]>,
    key: TKey,
    value: TValue
): void {
    const values = map.get(key) ?? [];

    values.push(value);
    map.set(key, values);
}

function findComponentContainingDeclaration(
    declaration: Node,
    componentsByFile: Map<string, InternalComponentInfo[]>
): InternalComponentInfo | undefined {
    const filePath = normalizeFilePath(
        declaration.getSourceFile().getFilePath()
    );
    const components = componentsByFile.get(filePath) ?? [];

    return components.find(component =>
        declaration.getStart() >= component.node.getStart() &&
        declaration.getEnd() <= component.node.getEnd()
    );
}

function getUniqueComponentByName(
    componentsByName: Map<string, InternalComponentInfo[]>,
    name: string
): InternalComponentInfo | undefined {
    const components = componentsByName.get(name) ?? [];

    if (components.length !== 1) {
        return undefined;
    }

    return components[0];
}

function getFallbackName(tagNameNode: Node): string {
    return tagNameNode.getText().split(".")[0] ?? "";
}

export function createComponentResolver(
    components: InternalComponentInfo[]
): ComponentResolver {
    const componentsBySymbol = new Map<Symbol, InternalComponentInfo>();
    const componentsByDeclarationKey = new Map<
        string,
        InternalComponentInfo
    >();
    const componentsByFile = new Map<string, InternalComponentInfo[]>();
    const componentsByName = new Map<string, InternalComponentInfo[]>();

    for (const component of components) {
        const componentSymbol = getComponentSymbol(component.node);
        const nameNode = getComponentNameNode(component.node);
        const filePath = normalizeFilePath(component.path);

        if (componentSymbol) {
            componentsBySymbol.set(
                resolveAliasedSymbol(componentSymbol),
                component
            );
        }

        componentsByDeclarationKey.set(getNodeKey(component.node), component);

        if (nameNode) {
            componentsByDeclarationKey.set(getNodeKey(nameNode), component);
        }

        addToMapList(componentsByFile, filePath, component);
        addToMapList(componentsByName, component.name, component);
    }

    function resolveByDeclaration(
        declaration: Node
    ): InternalComponentInfo | undefined {
        const directMatch = componentsByDeclarationKey.get(
            getNodeKey(declaration)
        );

        if (directMatch) {
            return directMatch;
        }

        return findComponentContainingDeclaration(
            declaration,
            componentsByFile
        );
    }

    function resolveByDeclarations(
        symbol: Symbol
    ): InternalComponentInfo | undefined {
        for (const declaration of symbol.getDeclarations()) {
            const component = resolveByDeclaration(declaration);

            if (component) {
                return component;
            }
        }

        return undefined;
    }

    function resolveExportedDeclaration(
        sourceFile: SourceFile,
        exportName: string
    ): InternalComponentInfo | undefined {
        const declarations = sourceFile
            .getExportedDeclarations()
            .get(exportName) ?? [];

        for (const declaration of declarations) {
            const component = resolveByDeclaration(declaration);

            if (component) {
                return component;
            }
        }

        return undefined;
    }

    function getResolvedSourceFile(
        sourceFile: SourceFile,
        moduleSpecifier: string
    ): SourceFile | undefined {
        const resolvedModule = ts.resolveModuleName(
            moduleSpecifier,
            sourceFile.getFilePath(),
            sourceFile.getProject().getCompilerOptions(),
            ts.sys
        ).resolvedModule;

        if (!resolvedModule) {
            return undefined;
        }

        return sourceFile
            .getProject()
            .getSourceFile(resolvedModule.resolvedFileName);
    }

    function resolveComponentInFile(
        sourceFile: SourceFile,
        exportName: string | undefined
    ): InternalComponentInfo | undefined {
        const componentsInFile = componentsByFile.get(
            normalizeFilePath(sourceFile.getFilePath())
        ) ?? [];

        if (exportName) {
            return resolveExportedDeclaration(sourceFile, exportName);
        }

        return (
            resolveExportedDeclaration(sourceFile, "default") ??
            componentsInFile.find(component => component.defaultExport) ??
            (componentsInFile.length === 1
                ? componentsInFile[0]
                : undefined)
        );
    }

    return {
        resolveJsxTag(tagNameNode: Node): InternalComponentInfo | undefined {
            const symbol = tagNameNode.getSymbol();

            if (!symbol) {
                return getUniqueComponentByName(
                    componentsByName,
                    getFallbackName(tagNameNode)
                );
            }

            const resolvedSymbol = resolveAliasedSymbol(symbol);

            return (
                componentsBySymbol.get(resolvedSymbol) ??
                resolveByDeclarations(resolvedSymbol)
            );
        },

        resolveReference(
            referenceNode: Node
        ): InternalComponentInfo | undefined {
            const symbol = referenceNode.getSymbol();

            if (!symbol) {
                return getUniqueComponentByName(
                    componentsByName,
                    referenceNode.getText()
                );
            }

            const resolvedSymbol = resolveAliasedSymbol(symbol);

            return (
                componentsBySymbol.get(resolvedSymbol) ??
                resolveByDeclarations(resolvedSymbol)
            );
        },

        resolveLazyImport(
            sourceFile: SourceFile,
            moduleSpecifier: string,
            exportName?: string
        ): InternalComponentInfo | undefined {
            const resolvedSourceFile = getResolvedSourceFile(
                sourceFile,
                moduleSpecifier
            );

            return resolvedSourceFile
                ? resolveComponentInFile(resolvedSourceFile, exportName)
                : undefined;
        },
    };
}
