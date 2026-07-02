import {ParameterDeclaration} from "ts-morph";
import {PropInfo} from "../types/ComponentInfo.js";

export function extractProps(
    firstParam?: ParameterDeclaration
): PropInfo[] {
    if (!firstParam) {
        return [];
    }

    const type = firstParam.getType();

    return type.getProperties().map(prop => {

        const declaration = prop.getDeclarations()[0];

        return {
            name: prop.getName(),
            type: declaration
                ? prop.getTypeAtLocation(declaration).getText()
                : prop.getTypeAtLocation(firstParam).getText(),
            optional: prop.isOptional(),
        };
    });
}