import path from "node:path";
import type { Project, SourceFile } from "ts-morph";

import { scanComponentsInSourceFiles } from "./componentScanner.js";
import { createComponentResolver } from "./componentResolver.js";
import type { ComponentResolver } from "./componentResolver.js";
import { buildDependencyMap } from "./dependencyScanner.js";
import type { DependencyMap } from "./dependencyScanner.js";
import { getProject } from "./projectManager.js";
import { buildUsageIndex } from "./usageScanner.js";
import type { UsageIndex } from "./usageScanner.js";
import { shouldIncludeFile } from "./pathMatcher.js";
import type { InternalComponentInfo } from "../types/ComponentInfo.js";
import type { ScanOptions } from "../types/ScanOptions.js";

export interface ScanContext {
    project: Project;
    sourceFiles: SourceFile[];
    components: InternalComponentInfo[];
    resolver: ComponentResolver;
    getUsageIndex(): UsageIndex;
    getDependencyMap(): DependencyMap;
}

export function createScanContext(
    projectPath: string,
    options: ScanOptions = {}
): ScanContext {
    const normalizedProjectPath = path.resolve(projectPath);
    const project = getProject(projectPath);
    const sourceFiles = project.getSourceFiles().filter(sourceFile =>
        shouldIncludeFile(
            normalizedProjectPath,
            sourceFile.getFilePath(),
            options
        )
    );
    const components = scanComponentsInSourceFiles(sourceFiles);
    const resolver = createComponentResolver(components);
    let usageIndex: UsageIndex | undefined;
    let dependencyMap: DependencyMap | undefined;

    return {
        project,
        sourceFiles,
        components,
        resolver,
        getUsageIndex(): UsageIndex {
            usageIndex ??= buildUsageIndex(
                sourceFiles,
                components,
                resolver
            );

            return usageIndex;
        },
        getDependencyMap(): DependencyMap {
            dependencyMap ??= buildDependencyMap(components, resolver);

            return dependencyMap;
        },
    };
}
