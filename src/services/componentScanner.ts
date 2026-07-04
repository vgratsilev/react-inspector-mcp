import { Node } from "ts-morph";
import type { SourceFile } from "ts-morph";
import path from "node:path";

import { getProject } from "./projectManager.js";
import {
    InternalComponentInfo,
    ComponentKind,
} from "../types/ComponentInfo.js";
import {extractComponentProps} from "./extractProps.js";
import { isReactComponent } from "./isReactComponent.js";
import { extractDescription } from "./extractDescription.js";
import { extractExportInfo } from "./extractExportInfo.js";
import type { ScanOptions } from "../types/ScanOptions.js";
import { shouldIncludeFile } from "./pathMatcher.js";
import type { ComponentNode } from "../types/ComponentNode.js";
import {
    getComponentImplementationNode,
    isLazyComponentDeclaration,
    isStyledComponentDeclaration,
    isWrappedComponentDeclaration,
} from "./componentNodeUtils.js";
import {
    createComponentWrapperSet,
    type ComponentWrapperName,
} from "./componentWrapperUtils.js";

function toPascalCase(value: string): string {
    const result = value
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map(part => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
        .join("");

    return result || "DefaultExport";
}

function getAnonymousDefaultExportName(file: SourceFile): string {
    const filePath = file.getFilePath();
    const extension = path.extname(filePath);
    const baseName = path.basename(filePath, extension);
    const parentName = path.basename(path.dirname(filePath));

    if (baseName === "index") {
        return toPascalCase(parentName);
    }

    if (baseName === "page" || baseName === "layout") {
        return `${toPascalCase(parentName)}${toPascalCase(baseName)}`;
    }

    return toPascalCase(baseName);
}

function getComponentName(
    node: ComponentNode,
    file: SourceFile
): string | undefined {
    if (Node.isExportAssignment(node)) {
        return getAnonymousDefaultExportName(file);
    }

    const name =
        "getName" in node
            ? node.getName()
            : undefined;

    if (name) {
        return name;
    }

    if (
        (
            Node.isClassDeclaration(node) ||
            Node.isFunctionDeclaration(node)
        ) &&
        node.isDefaultExport()
    ) {
        return getAnonymousDefaultExportName(file);
    }

    return undefined;
}

function getComponentKind(
    node: ComponentNode,
    wrapperNames: Set<ComponentWrapperName>
): ComponentKind {
    if (isStyledComponentDeclaration(node)) {
        return "styled";
    }

    if (isLazyComponentDeclaration(node)) {
        return "lazy";
    }

    if (Node.isClassDeclaration(node)) {
        return "class";
    }

    if (isWrappedComponentDeclaration(node, wrapperNames)) {
        return "wrapped";
    }

    return "function";
}

export function scanComponentsInSourceFiles(
    sourceFiles: SourceFile[],
    options: ScanOptions = {}
): InternalComponentInfo[] {
    const result: InternalComponentInfo[] = [];
    const wrapperNames = createComponentWrapperSet(
        options.componentWrappers
    );

    for (const file of sourceFiles) {
        const nodes = [
            ...file.getClasses(),
            ...file.getExportAssignments().filter(assignment =>
                !assignment.isExportEquals()
            ),
            ...file.getFunctions(),
            ...file.getVariableDeclarations(),
        ] satisfies ComponentNode[];

        for (const node of nodes) {

            const name = getComponentName(node, file);

            if (!name) continue;

            if (!/^[A-Z]/.test(name)) continue;

            if (!isReactComponent(node, wrapperNames)) continue;

            const props = extractComponentProps(node, wrapperNames);

            const description = extractDescription(node);

            const {
                exported,
                defaultExport
            } = extractExportInfo(node);

            result.push({
                name,
                kind: getComponentKind(node, wrapperNames),
                path: file.getFilePath(),
                declaration: {
                    filePath: file.getFilePath(),
                    ...file.getLineAndColumnAtPos(node.getStart()),
                },
                props,
                node,
                implementationNode: getComponentImplementationNode(
                    node,
                    wrapperNames
                ),
                description,
                exported,
                defaultExport,
            });

        }
    }

    return result;
}

export async function scanComponents(
    projectPath: string,
    options: ScanOptions = {}
): Promise<InternalComponentInfo[]> {

    const normalizedProjectPath = path.resolve(projectPath);
    const project = getProject(projectPath);
    const sourceFiles = project.getSourceFiles().filter(file =>
        shouldIncludeFile(
            normalizedProjectPath,
            file.getFilePath(),
            options
        )
    );

    return scanComponentsInSourceFiles(sourceFiles, options);
}
