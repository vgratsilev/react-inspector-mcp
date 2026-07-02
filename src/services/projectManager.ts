import { Project } from "ts-morph";
import path from "node:path";

const projects = new Map<string, Project>();

export function getProject(projectPath: string): Project {
    const normalizedPath = path.resolve(projectPath);

    if (projects.has(normalizedPath)) {
        const project = projects.get(normalizedPath)!;

        for (const sourceFile of project.getSourceFiles()) {
            sourceFile.refreshFromFileSystemSync();
        }

        return project;
    }

    const project = new Project({
        tsConfigFilePath: path.join(normalizedPath, "tsconfig.json"),
    });

    projects.set(normalizedPath, project);

    return project;
}
