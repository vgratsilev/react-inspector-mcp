import {
    ClassDeclaration,
    ExportAssignment,
    FunctionDeclaration,
    Node,
    VariableDeclaration
} from "ts-morph";

export type ComponentKind =
    | "function"
    | "class"
    | "wrapped"
    | "lazy"
    | "styled";

export interface PropInfo {
    name: string;
    type: string;
    optional: boolean;
    defaultValue?: string;
}

export interface SourceLocation {
    filePath: string;
    line: number;
    column: number;
}

export interface ComponentInfo {
    name: string;
    kind: ComponentKind;
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

export interface ComponentReportLocation {
    filePath: string;
    line: number;
    column: number;
    kind: ComponentUsageLocation["kind"] | ComponentReferenceKind;
    text?: string;
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

export const DEFAULT_REPORT_LOCATION_LIMIT = 20;

export interface ComponentReportOptions {
    locationLimit?: number;
    includeSourceText?: boolean;
}

export type ComponentReportRiskReason =
    | UnusedComponentReason
    | "has_external_jsx_usages";

export interface ComponentReportRisk {
    candidate: boolean;
    confidence: UnusedComponentConfidence | null;
    reason: ComponentReportRiskReason;
    usageKinds: ComponentReferenceKind[];
    referenceCount: number;
    returnedReferences: number;
    references: ComponentReportLocation[];
}

export interface ComponentReportPropSummary {
    name: string;
    optional: boolean;
    defaultValue?: string;
}

export interface ComponentReportItem {
    name: string;
    kind: ComponentKind;
    path: string;
    declaration: SourceLocation;
    description?: string;
    exported?: boolean;
    defaultExport?: boolean;
}

export interface ComponentReportUsage {
    usageCount: number;
    returned: number;
    locations: ComponentReportLocation[];
}

export interface ComponentReportDependency {
    name: string;
    path: string;
    usageCount: number;
    returned: number;
    usages: ComponentReportLocation[];
}

export interface ComponentReport {
    component: ComponentReportItem;
    propsSummary: ComponentReportPropSummary[];
    usages: ComponentReportUsage;
    dependencies: ComponentReportDependency[];
    dependents: ComponentReportDependency[];
    risk: ComponentReportRisk;
}

export const dependencyGraphDirections = [
    "dependencies",
    "dependents",
    "both",
] as const;

export type DependencyGraphDirection =
    (typeof dependencyGraphDirections)[number];

export const DEFAULT_DEPENDENCY_GRAPH_MAX_NODES = 50;

export const MAX_DEPENDENCY_GRAPH_DEPTH = 5;

export interface DependencyGraphOptions {
    direction?: DependencyGraphDirection;
    depth?: number;
    maxNodes?: number;
}

export interface DependencyGraphNode {
    id: string;
    name: string;
    kind: ComponentKind;
    path: string;
}

export interface DependencyGraphEdge {
    from: string;
    to: string;
    usageCount: number;
    returned: number;
    usageKinds: ComponentUsageLocation["kind"][];
    usages: ComponentReportLocation[];
}

export interface DependencyGraph {
    root: string;
    nodes: DependencyGraphNode[];
    edges: DependencyGraphEdge[];
    depth: number;
    direction: DependencyGraphDirection;
    truncated: boolean;
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

    node:
        | ClassDeclaration
        | ExportAssignment
        | FunctionDeclaration
        | VariableDeclaration;
    implementationNode: Node;

    description?: string;
    exported?: boolean;
    defaultExport?: boolean;
}
