import {Node, SyntaxKind} from "ts-morph";
import type {ComponentNode} from './../types/ComponentNode.js';
import {
    getComponentFunction,
    getComponentImplementationNode,
    isLazyComponentDeclaration,
    isStyledComponentDeclaration,
} from "./componentNodeUtils.js";
import type { ComponentWrapperName } from "./componentWrapperUtils.js";

function hasJsx(node: Node): boolean {
    return (
        node.getDescendantsOfKind(
            SyntaxKind.JsxElement
        ).length > 0 ||

        node.getDescendantsOfKind(
            SyntaxKind.JsxSelfClosingElement
        ).length > 0
    );
}

export function isReactComponent(
    node: ComponentNode,
    wrapperNames: Set<ComponentWrapperName>
): boolean {

    if (isLazyComponentDeclaration(node)) {
        return true;
    }

    if (isStyledComponentDeclaration(node)) {
        return true;
    }

    if (Node.isFunctionDeclaration(node)) {
        return hasJsx(getComponentImplementationNode(node, wrapperNames));
    }

    if (Node.isClassDeclaration(node)) {
        return hasJsx(getComponentImplementationNode(node, wrapperNames));
    }

    const componentFunction = getComponentFunction(node, wrapperNames);

    return componentFunction
        ? hasJsx(componentFunction)
        : false;
}
