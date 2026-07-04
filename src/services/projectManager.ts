import { FileSystemRefreshResult, Project } from "ts-morph";
import path from "node:path";

const projectCache = new Map<string, ProjectCacheEntry>();
const projectCacheTtlMs = 30_000;
const maxProjectCacheEntries = 5;

interface ProjectCacheEntry {
    projectPath: string;
    tsconfigPath: string;
    project: Project;
    createdAt: number;
    lastAccessedAt: number;
    lastRefreshAt: number;
}

export interface ProjectCacheStats {
    size: number;
    maxSize: number;
    ttlMs: number;
    entries: ProjectCacheEntryInfo[];
}

export interface ProjectCacheEntryInfo {
    projectPath: string;
    tsconfigPath: string;
    sourceFileCount: number;
    createdAt: number;
    lastAccessedAt: number;
    lastRefreshAt: number;
}

export interface ProjectRefreshResult {
    projectPath: string;
    tsconfigPath: string;
    sourceFileCount: number;
    cacheSize: number;
    refreshed: true;
}

function normalizeProjectPath(projectPath: string): string {
    return path.resolve(projectPath);
}

function getTsconfigPath(projectPath: string): string {
    return path.join(projectPath, "tsconfig.json");
}

function getCacheKey(projectPath: string, tsconfigPath: string): string {
    return `${projectPath}::${tsconfigPath}`;
}

function createProject(tsconfigPath: string): Project {
    return new Project({
        tsConfigFilePath: tsconfigPath,
    });
}

function evictExpiredEntries(now: number): void {
    for (const [key, entry] of projectCache) {
        if (now - entry.lastAccessedAt > projectCacheTtlMs) {
            projectCache.delete(key);
        }
    }
}

function evictLeastRecentlyUsedEntries(): void {
    while (projectCache.size > maxProjectCacheEntries) {
        let oldestKey: string | undefined;
        let oldestAccess = Number.POSITIVE_INFINITY;

        for (const [key, entry] of projectCache) {
            if (entry.lastAccessedAt < oldestAccess) {
                oldestKey = key;
                oldestAccess = entry.lastAccessedAt;
            }
        }

        if (!oldestKey) {
            return;
        }

        projectCache.delete(oldestKey);
    }
}

function refreshProjectEntry(
    entry: ProjectCacheEntry,
    now: number
): void {
    for (const sourceFile of [...entry.project.getSourceFiles()]) {
        const refreshResult = sourceFile.refreshFromFileSystemSync();

        if (refreshResult === FileSystemRefreshResult.Deleted) {
            entry.project.removeSourceFile(sourceFile);
        }
    }

    entry.project.addSourceFilesFromTsConfig(entry.tsconfigPath);
    entry.lastRefreshAt = now;
}

function getOrCreateProjectEntry(projectPath: string): ProjectCacheEntry {
    const now = Date.now();
    const normalizedProjectPath = normalizeProjectPath(projectPath);
    const tsconfigPath = getTsconfigPath(normalizedProjectPath);
    const cacheKey = getCacheKey(normalizedProjectPath, tsconfigPath);

    evictExpiredEntries(now);

    const existingEntry = projectCache.get(cacheKey);

    if (existingEntry) {
        existingEntry.lastAccessedAt = now;
        refreshProjectEntry(existingEntry, now);

        return existingEntry;
    }

    const entry: ProjectCacheEntry = {
        projectPath: normalizedProjectPath,
        tsconfigPath,
        project: createProject(tsconfigPath),
        createdAt: now,
        lastAccessedAt: now,
        lastRefreshAt: now,
    };

    projectCache.set(cacheKey, entry);
    refreshProjectEntry(entry, now);
    evictLeastRecentlyUsedEntries();

    return entry;
}

function toProjectCacheEntryInfo(
    entry: ProjectCacheEntry
): ProjectCacheEntryInfo {
    return {
        projectPath: entry.projectPath,
        tsconfigPath: entry.tsconfigPath,
        sourceFileCount: entry.project.getSourceFiles().length,
        createdAt: entry.createdAt,
        lastAccessedAt: entry.lastAccessedAt,
        lastRefreshAt: entry.lastRefreshAt,
    };
}

export function getProject(projectPath: string): Project {
    return getOrCreateProjectEntry(projectPath).project;
}

export function refreshProjectCache(
    projectPath: string
): ProjectRefreshResult {
    const entry = getOrCreateProjectEntry(projectPath);

    return {
        projectPath: entry.projectPath,
        tsconfigPath: entry.tsconfigPath,
        sourceFileCount: entry.project.getSourceFiles().length,
        cacheSize: projectCache.size,
        refreshed: true,
    };
}

export function getProjectCacheStats(): ProjectCacheStats {
    return {
        size: projectCache.size,
        maxSize: maxProjectCacheEntries,
        ttlMs: projectCacheTtlMs,
        entries: [...projectCache.values()].map(toProjectCacheEntryInfo),
    };
}

export function clearProjectCache(): void {
    projectCache.clear();
}
