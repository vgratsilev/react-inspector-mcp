import {
    CallExpression,
    Node,
    ParameterDeclaration,
    VariableDeclaration,
} from "ts-morph";

import type { ComponentNode } from "../types/ComponentNode.js";
import type {
    ComponentFunction,
    ComponentWrapperName,
} from "./componentWrapperUtils.js";
import {
    getCallName,
    hasComponentWrapper,
    unwrapComponentFunction,
} from "./componentWrapperUtils.js";
import { isStyledComponentExpression } from "./styledComponentUtils.js";

function isCallNamed(node: Node, names: string[]): boolean {
    if (!Node.isCallExpression(node)) {
        return false;
    }

    return names.includes(getCallName(node));
}

export function getComponentFunction(
    node: ComponentNode,
    wrapperNames: Set<ComponentWrapperName>
): ComponentFunction | undefined {
    if (
        !Node.isVariableDeclaration(node) &&
        !Node.isExportAssignment(node)
    ) {
        return undefined;
    }

    const initializer = Node.isVariableDeclaration(node)
        ? node.getInitializer()
        : node.getExpression();

    if (!initializer) {
        return undefined;
    }

    return unwrapComponentFunction(initializer, wrapperNames);
}

export function isLazyComponentDeclaration(
    node: ComponentNode
): boolean {
    if (
        !Node.isVariableDeclaration(node) &&
        !Node.isExportAssignment(node)
    ) {
        return false;
    }

    const initializer = Node.isVariableDeclaration(node)
        ? node.getInitializer()
        : node.getExpression();

    if (!initializer) {
        return false;
    }

    return isCallNamed(initializer, ["lazy", "React.lazy"]);
}

export function isStyledComponentDeclaration(
    node: ComponentNode
): boolean {
    if (
        !Node.isVariableDeclaration(node) &&
        !Node.isExportAssignment(node)
    ) {
        return false;
    }

    const initializer = Node.isVariableDeclaration(node)
        ? node.getInitializer()
        : node.getExpression();

    return initializer
        ? isStyledComponentExpression(initializer)
        : false;
}

export function isWrappedComponentDeclaration(
    node: ComponentNode,
    wrapperNames: Set<ComponentWrapperName>
): boolean {
    if (
        !Node.isVariableDeclaration(node) &&
        !Node.isExportAssignment(node)
    ) {
        return false;
    }

    const initializer = Node.isVariableDeclaration(node)
        ? node.getInitializer()
        : node.getExpression();

    return initializer
        ? hasComponentWrapper(initializer, wrapperNames)
        : false;
}

export function getComponentPropsParameter(
    node: ComponentNode,
    wrapperNames: Set<ComponentWrapperName>
): ParameterDeclaration | undefined {
    if (Node.isFunctionDeclaration(node)) {
        return node.getParameters()[0];
    }

    return getComponentFunction(node, wrapperNames)?.getParameters()[0];
}

export function getComponentImplementationNode(
    node: ComponentNode,
    wrapperNames: Set<ComponentWrapperName>
): Node {
    if (Node.isClassDeclaration(node)) {
        return node.getInstanceMethod("render") ?? node;
    }

    return getComponentFunction(node, wrapperNames) ?? node;
}
