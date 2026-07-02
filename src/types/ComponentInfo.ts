import {
    FunctionDeclaration,
    VariableDeclaration
} from "ts-morph";

export interface PropInfo {
    name: string;
    type: string;
    optional: boolean;
}

export interface SourceLocation {
    filePath: string;
    line: number;
    column: number;
}

export interface ComponentInfo {
    name: string;
    path: string;
    declaration: SourceLocation;
    props: PropInfo[];
}

export interface ComponentUsageLocation {
    filePath: string;
    line: number;
    column: number;
    kind: "jsx";
    text: string;
}

export interface ComponentUsage {
    usageCount: number;
    usedIn: ComponentUsageLocation[];
}

export type UnusedComponentRisk = "low" | "medium" | "high";

export interface UnusedComponentInfo extends FullComponentInfo {
    reason: "no_external_jsx_usages";
    risk: UnusedComponentRisk;
}

export interface ComponentDependency {
    name: string;
    path: string;
    usages: ComponentUsageLocation[];
}

export interface ComponentDependencies {
    componentName: string;
    dependencies: ComponentDependency[];
}

export interface ComponentDependent {
    name: string;
    path: string;
    usages: ComponentUsageLocation[];
}

export interface ComponentDependents {
    componentName: string;
    dependents: ComponentDependent[];
}

export interface ComponentNotFound {
    found: false;
    componentName: string;
    message: string;
}

export interface FullComponentInfo
    extends ComponentInfo,
        ComponentUsage {

    exported?: boolean;
    defaultExport?: boolean;
    description?: string;
}

export interface InternalComponentInfo
    extends ComponentInfo {

    node: FunctionDeclaration | VariableDeclaration;

    description?: string;
    exported?: boolean;
    defaultExport?: boolean;
}
