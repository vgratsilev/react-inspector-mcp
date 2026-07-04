import {Node} from "ts-morph";
import type {ComponentNode} from "../types/ComponentNode.js";

export function extractDescription(
    node: ComponentNode
): string | undefined {

    if (
        Node.isClassDeclaration(node) ||
        Node.isFunctionDeclaration(node)
    ) {
        const docs = node.getJsDocs();

        return docs.length
            ? docs.map(doc => doc.getDescription().trim()).join("\n")
            : undefined;
    }

    if (Node.isExportAssignment(node)) {
        return undefined;
    }

    const statement = node.getVariableStatement();

    if (!statement) {
        return undefined;
    }

    const docs = statement.getJsDocs();

    return docs.length
        ? docs.map(doc => doc.getDescription().trim()).join("\n")
        : undefined;
}
