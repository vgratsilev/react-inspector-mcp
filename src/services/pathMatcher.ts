import path from "node:path";

import type { ScanOptions } from "../types/ScanOptions.js";

const defaultExclude = [
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/storybook-static/**",
];

function normalizePath(value: string): string {
    return value.replace(/\\/g, "/");
}

function escapeRegex(value: string): string {
    return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globToRegex(glob: string): RegExp {
    const normalized = normalizePath(glob);
    let pattern = "";

    for (let index = 0; index < normalized.length; index++) {
        const char = normalized[index];
        const next = normalized[index + 1];

        if (char === "*" && next === "*") {
            pattern += ".*";
            index++;
        } else if (char === "*") {
            pattern += "[^/]*";
        } else if (char === "?") {
            pattern += "[^/]";
        } else {
            pattern += escapeRegex(char);
        }
    }

    return new RegExp(`^${pattern}$`);
}

function matchesAny(relativePath: string, globs: string[]): boolean {
    return globs.some(glob => globToRegex(glob).test(relativePath));
}

export function shouldIncludeFile(
    projectPath: string,
    filePath: string,
    options: ScanOptions = {}
): boolean {
    const relativePath = normalizePath(
        path.relative(projectPath, filePath)
    );
    const include = options.include ?? [];
    const exclude = [...defaultExclude, ...(options.exclude ?? [])];

    if (include.length > 0 && !matchesAny(relativePath, include)) {
        return false;
    }

    return !matchesAny(relativePath, exclude);
}
