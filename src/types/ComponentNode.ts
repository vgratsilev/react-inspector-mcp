import {
    ClassDeclaration,
    ExportAssignment,
    FunctionDeclaration,
    VariableDeclaration,
} from "ts-morph";

export type ComponentNode =
    | ClassDeclaration
    | ExportAssignment
    | FunctionDeclaration
    | VariableDeclaration;
