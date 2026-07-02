import {Node, SyntaxKind} from "ts-morph";
import type {ComponentNode} from './../types/ComponentNode.js';
import {
    getComponentImplementationNode,
    isLazyComponentDeclaration,
} from "./componentNodeUtils.js";

export function isReactComponent(node: ComponentNode): boolean {

    if (isLazyComponentDeclaration(node)) {
        return true;
    }

    const implementationNode = getComponentImplementationNode(node);

    return (
        implementationNode.getDescendantsOfKind(
            SyntaxKind.JsxElement
        ).length > 0 ||

        implementationNode.getDescendantsOfKind(
            SyntaxKind.JsxSelfClosingElement
        ).length > 0
    );
}
