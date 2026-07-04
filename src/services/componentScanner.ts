import { Node } from "ts-morph";
import type { SourceFile } from "ts-morph";
import path from "node:path";

import { getProject } from "./projectManager.js";
import {
    InternalComponentInfo,
} from "../types/ComponentInfo.js";
import {extractProps} from "./extractProps.js";
import { isReactComponent } from "./isReactComponent.js";
import { extractDescription } from "./extractDescription.js";
import { extractExportInfo } from "./extractExportInfo.js";
import type { ScanOptions } from "../types/ScanOptions.js";
import { shouldIncludeFile } from "./pathMatcher.js";
import { getComponentPropsParameter } from "./componentNodeUtils.js";

export function scanComponentsInSourceFiles(
    sourceFiles: SourceFile[]
): InternalComponentInfo[] {
    const result: InternalComponentInfo[] = [];

    for (const file of sourceFiles) {
        const nodes = [
            ...file.getFunctions(),
            ...file.getVariableDeclarations(),
        ];

        for (const node of nodes) {

            const name =
                "getName" in node
                    ? node.getName()
                    : undefined;

            if (!name) continue;

            if (!/^[A-Z]/.test(name)) continue;

            if (!isReactComponent(node)) continue;

            const props = extractProps(
                getComponentPropsParameter(node)
            );

            const description = extractDescription(node);

            const {
                exported,
                defaultExport
            } = extractExportInfo(node);

            result.push({
                name,
                path: file.getFilePath(),
                declaration: {
                    filePath: file.getFilePath(),
                    ...file.getLineAndColumnAtPos(node.getStart()),
                },
                props,
                node,
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

    return scanComponentsInSourceFiles(sourceFiles);
}
