import {
    ArrowFunction,
    CallExpression,
    FunctionExpression,
    Node,
    ParameterDeclaration,
    VariableDeclaration,
} from "ts-morph";

import type { ComponentNode } from "../types/ComponentNode.js";

type ComponentFunction = ArrowFunction | FunctionExpression;

function getCallName(callExpression: CallExpression): string {
    const expression = callExpression.getExpression();

    if (Node.isIdentifier(expression)) {
        return expression.getText();
    }

    if (Node.isPropertyAccessExpression(expression)) {
        return expression.getName();
    }

    return expression.getText();
}

function isCallNamed(node: Node, names: string[]): boolean {
    if (!Node.isCallExpression(node)) {
        return false;
    }

    return names.includes(getCallName(node));
}

function unwrapComponentFunction(
    node: Node
): ComponentFunction | undefined {
    if (
        Node.isArrowFunction(node) ||
        Node.isFunctionExpression(node)
    ) {
        return node;
    }

    if (!Node.isCallExpression(node)) {
        return undefined;
    }

    const callName = getCallName(node);

    if (callName !== "memo" && callName !== "forwardRef") {
        return undefined;
    }

    const firstArgument = node.getArguments()[0];

    if (!firstArgument) {
        return undefined;
    }

    return unwrapComponentFunction(firstArgument);
}

export function getComponentFunction(
    node: ComponentNode
): ComponentFunction | undefined {
    if (!Node.isVariableDeclaration(node)) {
        return undefined;
    }

    const initializer = node.getInitializer();

    if (!initializer) {
        return undefined;
    }

    return unwrapComponentFunction(initializer);
}

export function isLazyComponentDeclaration(
    node: ComponentNode
): boolean {
    if (!Node.isVariableDeclaration(node)) {
        return false;
    }

    const initializer = node.getInitializer();

    if (!initializer) {
        return false;
    }

    return isCallNamed(initializer, ["lazy"]);
}

export function getComponentPropsParameter(
    node: ComponentNode
): ParameterDeclaration | undefined {
    if (Node.isFunctionDeclaration(node)) {
        return node.getParameters()[0];
    }

    return getComponentFunction(node)?.getParameters()[0];
}

export function getComponentImplementationNode(
    node: ComponentNode
): Node {
    return getComponentFunction(node) ?? node;
}
