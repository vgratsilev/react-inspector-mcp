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
    kind: "jsx" | "lazy_import";
    text: string;
}

export interface ComponentUsage {
    usageCount: number;
    usedIn: ComponentUsageLocation[];
}

export type ComponentReferenceKind =
    | "react_create_element"
    | "value_reference"
    | "route_config_reference"
    | "dynamic_reference"
    | "lazy_import";

export interface ComponentReferenceLocation {
    filePath: string;
    line: number;
    column: number;
    kind: ComponentReferenceKind;
    text: string;
}

export type UnusedComponentConfidence = "low" | "medium" | "high";

export type UnusedComponentRisk = UnusedComponentConfidence;

export type UnusedComponentReason =
    | "no_known_external_usages"
    | "no_external_jsx_usages_but_has_known_references";

export interface UnusedComponentInfo extends FullComponentInfo {
    reason: UnusedComponentReason;
    usageKinds: ComponentReferenceKind[];
    references: ComponentReferenceLocation[];
    confidence: UnusedComponentConfidence;
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
