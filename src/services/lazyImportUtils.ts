import {
    ArrowFunction,
    CallExpression,
    FunctionExpression,
    Node,
    SyntaxKind,
} from "ts-morph";

import type { ComponentNode } from "../types/ComponentNode.js";

type LazyLoaderFunction = ArrowFunction | FunctionExpression;

export interface LazyImportReference {
    moduleSpecifier: string;
    exportName?: string;
    lazyCall: CallExpression;
}

function getCallName(callExpression: CallExpression): string {
    return callExpression.getExpression().getText();
}

function isLazyCall(node: Node): node is CallExpression {
    return Node.isCallExpression(node) &&
        ["lazy", "React.lazy"].includes(getCallName(node));
}

function isDynamicImportCall(node: Node): node is CallExpression {
    return (
        Node.isCallExpression(node) &&
        node.getExpression().getKind() === SyntaxKind.ImportKeyword
    );
}

function getLazyLoaderFunction(
    lazyCall: CallExpression
): LazyLoaderFunction | undefined {
    const firstArgument = lazyCall.getArguments()[0];

    if (
        !firstArgument ||
        (
            !Node.isArrowFunction(firstArgument) &&
            !Node.isFunctionExpression(firstArgument)
        )
    ) {
        return undefined;
    }

    return firstArgument;
}

function findDynamicImportCall(
    node: Node
): CallExpression | undefined {
    if (isDynamicImportCall(node)) {
        return node;
    }

    return node.getDescendants().find(isDynamicImportCall);
}

function getImportModuleSpecifier(
    importCall: CallExpression
): string | undefined {
    const moduleSpecifier = importCall.getArguments()[0];

    if (!moduleSpecifier || !Node.isStringLiteral(moduleSpecifier)) {
        return undefined;
    }

    return moduleSpecifier.getLiteralValue();
}

function getThenCallForImport(
    importCall: CallExpression
): CallExpression | undefined {
    const propertyAccess = importCall.getParentIfKind(
        SyntaxKind.PropertyAccessExpression
    );

    if (propertyAccess?.getName() !== "then") {
        return undefined;
    }

    return propertyAccess.getParentIfKind(SyntaxKind.CallExpression);
}

function unwrapParenthesizedExpression(node: Node): Node {
    let current = node;

    while (Node.isParenthesizedExpression(current)) {
        current = current.getExpression();
    }

    return current;
}

function getReturnedExpression(
    callback: LazyLoaderFunction
): Node | undefined {
    const body = callback.getBody();

    if (!Node.isBlock(body)) {
        return unwrapParenthesizedExpression(body);
    }

    const returnStatement = body.getStatements().find(Node.isReturnStatement);
    const expression = returnStatement?.getExpression();

    return expression
        ? unwrapParenthesizedExpression(expression)
        : undefined;
}

function getModuleParameterName(
    callback: LazyLoaderFunction
): string | undefined {
    const parameterName = callback.getParameters()[0]?.getNameNode();

    return Node.isIdentifier(parameterName)
        ? parameterName.getText()
        : undefined;
}

function getExportNameFromModuleProperty(
    node: Node,
    moduleParameterName: string | undefined
): string | undefined {
    if (!moduleParameterName || !Node.isPropertyAccessExpression(node)) {
        return undefined;
    }

    if (node.getExpression().getText() !== moduleParameterName) {
        return undefined;
    }

    return node.getName();
}

function getDefaultPropertyInitializer(
    expression: Node
): Node | undefined {
    if (!Node.isObjectLiteralExpression(expression)) {
        return expression;
    }

    for (const property of expression.getProperties()) {
        if (
            Node.isPropertyAssignment(property) &&
            property.getName() === "default"
        ) {
            return property.getInitializer();
        }
    }

    return undefined;
}

function getNamedExportFromThenCall(
    importCall: CallExpression
): string | undefined {
    const thenCall = getThenCallForImport(importCall);
    const callback = thenCall?.getArguments()[0];

    if (
        !callback ||
        (
            !Node.isArrowFunction(callback) &&
            !Node.isFunctionExpression(callback)
        )
    ) {
        return undefined;
    }

    const returnedExpression = getReturnedExpression(callback);
    const defaultInitializer = returnedExpression
        ? getDefaultPropertyInitializer(returnedExpression)
        : undefined;

    return defaultInitializer
        ? getExportNameFromModuleProperty(
            defaultInitializer,
            getModuleParameterName(callback)
        )
        : undefined;
}

export function getLazyImportReference(
    node: ComponentNode
): LazyImportReference | undefined {
    if (
        !Node.isVariableDeclaration(node) &&
        !Node.isExportAssignment(node)
    ) {
        return undefined;
    }

    const initializer = Node.isVariableDeclaration(node)
        ? node.getInitializer()
        : node.getExpression();

    if (!initializer || !isLazyCall(initializer)) {
        return undefined;
    }

    const loader = getLazyLoaderFunction(initializer);
    const importCall = loader
        ? findDynamicImportCall(loader)
        : undefined;
    const moduleSpecifier = importCall
        ? getImportModuleSpecifier(importCall)
        : undefined;

    if (!importCall || !moduleSpecifier) {
        return undefined;
    }

    return {
        moduleSpecifier,
        exportName: getNamedExportFromThenCall(importCall),
        lazyCall: initializer,
    };
}
