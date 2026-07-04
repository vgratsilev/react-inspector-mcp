import { Node, SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";

import {
    ComponentReferenceKind,
    ComponentReferenceLocation,
    InternalComponentInfo,
} from "../types/ComponentInfo.js";
import {
    getComponentKey,
} from "./componentResolver.js";
import type { ComponentResolver } from "./componentResolver.js";

export type ComponentReferenceIndex = Map<
    string,
    ComponentReferenceLocation[]
>;

const routeConfigPropertyNames = new Set([
    "component",
    "Component",
    "element",
]);

const ignoredAncestorKinds = new Set([
    SyntaxKind.ImportDeclaration,
    SyntaxKind.ExportDeclaration,
    SyntaxKind.ExportAssignment,
    SyntaxKind.TypeReference,
    SyntaxKind.TypeAliasDeclaration,
    SyntaxKind.InterfaceDeclaration,
    SyntaxKind.ImportType,
    SyntaxKind.TypeLiteral,
    SyntaxKind.PropertySignature,
    SyntaxKind.TypeQuery,
    SyntaxKind.ExpressionWithTypeArguments,
]);

function isSameNode(left: Node, right: Node): boolean {
    return (
        left.getSourceFile().getFilePath() ===
            right.getSourceFile().getFilePath() &&
        left.getStart() === right.getStart() &&
        left.getEnd() === right.getEnd()
    );
}

function shouldIgnoreReference(referenceNode: Node): boolean {
    if (!Node.isIdentifier(referenceNode)) {
        return true;
    }

    const parent = referenceNode.getParent();

    if (
        parent &&
        (
            Node.isJsxOpeningElement(parent) ||
            Node.isJsxSelfClosingElement(parent) ||
            Node.isJsxClosingElement(parent)
        )
    ) {
        return true;
    }

    return referenceNode.getAncestors().some(ancestor =>
        ignoredAncestorKinds.has(ancestor.getKind())
    );
}

function getPropertyName(propertyNameNode: Node): string | undefined {
    if (Node.isIdentifier(propertyNameNode)) {
        return propertyNameNode.getText();
    }

    if (Node.isStringLiteral(propertyNameNode)) {
        return propertyNameNode.getLiteralValue();
    }

    return undefined;
}

function isReactCreateElementReference(referenceNode: Node): boolean {
    const parent = referenceNode.getParent();

    if (!parent || !Node.isCallExpression(parent)) {
        return false;
    }

    const firstArgument = parent.getArguments()[0];

    if (!firstArgument || !isSameNode(firstArgument, referenceNode)) {
        return false;
    }

    const expression = parent.getExpression();

    if (Node.isIdentifier(expression)) {
        return expression.getText() === "createElement";
    }

    if (!Node.isPropertyAccessExpression(expression)) {
        return false;
    }

    return (
        expression.getExpression().getText() === "React" &&
        expression.getName() === "createElement"
    );
}

function isRouteConfigReference(referenceNode: Node): boolean {
    const parent = referenceNode.getParent();

    if (!parent || !Node.isPropertyAssignment(parent)) {
        return false;
    }

    const initializer = parent.getInitializer();

    if (!initializer || !isSameNode(initializer, referenceNode)) {
        return false;
    }

    const propertyName = getPropertyName(parent.getNameNode());

    if (!propertyName) {
        return false;
    }

    return routeConfigPropertyNames.has(propertyName);
}

function isDynamicReference(referenceNode: Node): boolean {
    const parent = referenceNode.getParent();

    if (!parent || !Node.isCallExpression(parent)) {
        return false;
    }

    return parent.getArguments().some(argument =>
        isSameNode(argument, referenceNode)
    );
}

function getReferenceKind(referenceNode: Node): ComponentReferenceKind {
    if (isReactCreateElementReference(referenceNode)) {
        return "react_create_element";
    }

    if (isRouteConfigReference(referenceNode)) {
        return "route_config_reference";
    }

    if (isDynamicReference(referenceNode)) {
        return "dynamic_reference";
    }

    return "value_reference";
}

function createReferenceLocation(
    referenceNode: Node,
    kind: ComponentReferenceKind
): ComponentReferenceLocation {
    const sourceFile = referenceNode.getSourceFile();
    const { line, column } = sourceFile.getLineAndColumnAtPos(
        referenceNode.getStart()
    );

    return {
        filePath: sourceFile.getFilePath(),
        line,
        column,
        kind,
        text: referenceNode.getText(),
    };
}

function addReference(
    referenceIndex: ComponentReferenceIndex,
    seen: Set<string>,
    component: InternalComponentInfo,
    referenceNode: Node,
    kind: ComponentReferenceKind
): void {
    const componentKey = getComponentKey(component);
    const reference = createReferenceLocation(referenceNode, kind);
    const key = [
        componentKey,
        reference.filePath,
        reference.line,
        reference.column,
        reference.kind,
    ].join(":");

    if (seen.has(key)) {
        return;
    }

    seen.add(key);

    const references = referenceIndex.get(componentKey) ?? [];

    references.push(reference);
    referenceIndex.set(componentKey, references);
}

export function getComponentReferencesFromIndex(
    component: InternalComponentInfo,
    referenceIndex: ComponentReferenceIndex
): ComponentReferenceLocation[] {
    return referenceIndex.get(getComponentKey(component)) ?? [];
}

export function buildComponentReferenceIndex(
    sourceFiles: SourceFile[],
    components: InternalComponentInfo[],
    resolver: ComponentResolver
): ComponentReferenceIndex {
    const referenceIndex: ComponentReferenceIndex = new Map(
        components.map(component => [getComponentKey(component), []])
    );
    const seen = new Set<string>();

    for (const sourceFile of sourceFiles) {
        const filePath = sourceFile.getFilePath();

        sourceFile.forEachDescendant(referenceNode => {
            if (shouldIgnoreReference(referenceNode)) {
                return;
            }

            const component = resolver.resolveReference(referenceNode);

            if (!component || filePath === component.path) {
                return;
            }

            addReference(
                referenceIndex,
                seen,
                component,
                referenceNode,
                getReferenceKind(referenceNode)
            );
        });
    }

    return referenceIndex;
}
