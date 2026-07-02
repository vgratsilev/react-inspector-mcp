import {Node, SyntaxKind} from "ts-morph";
import type {ComponentNode} from './../types/ComponentNode.js';
import {
    getComponentFunction,
    getComponentImplementationNode,
    isLazyComponentDeclaration,
} from "./componentNodeUtils.js";

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

export function isReactComponent(node: ComponentNode): boolean {

    if (isLazyComponentDeclaration(node)) {
        return true;
    }

    if (Node.isFunctionDeclaration(node)) {
        return hasJsx(getComponentImplementationNode(node));
    }

    const componentFunction = getComponentFunction(node);

    return componentFunction
        ? hasJsx(componentFunction)
        : false;
}
