import {Node} from "ts-morph";
import type {ComponentNode} from "../types/ComponentNode.js";

export function extractExportInfo(
    node: ComponentNode
) {
    if (Node.isFunctionDeclaration(node)) {
        return {
            exported: node.isExported(),
            defaultExport: node.isDefaultExport(),
        };
    }

    const statement = node.getVariableStatement();

    return {
        exported: statement?.isExported() ?? false,
        defaultExport: statement?.isDefaultExport() ?? false,
    };
}