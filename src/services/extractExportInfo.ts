import {Node} from "ts-morph";
import type {ComponentNode} from "../types/ComponentNode.js";

export function extractExportInfo(
    node: ComponentNode
) {
    if (
        Node.isClassDeclaration(node) ||
        Node.isFunctionDeclaration(node)
    ) {
        return {
            exported: node.isExported(),
            defaultExport: node.isDefaultExport(),
        };
    }

    if (Node.isExportAssignment(node)) {
        return {
            exported: true,
            defaultExport: !node.isExportEquals(),
        };
    }

    const statement = node.getVariableStatement();

    return {
        exported: statement?.isExported() ?? false,
        defaultExport: statement?.isDefaultExport() ?? false,
    };
}
