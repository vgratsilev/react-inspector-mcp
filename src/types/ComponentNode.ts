import { FunctionDeclaration, VariableDeclaration } from "ts-morph";

export type ComponentNode =
    | FunctionDeclaration
    | VariableDeclaration;