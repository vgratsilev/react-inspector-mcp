import {
    CallExpression,
    Node,
    ParameterDeclaration,
    Type,
} from "ts-morph";

import { PropInfo } from "../types/ComponentInfo.js";
import type { ComponentNode } from "../types/ComponentNode.js";
import {
    getCallName,
    type ComponentWrapperName,
} from "./componentWrapperUtils.js";
import { getComponentPropsParameter } from "./componentNodeUtils.js";

const functionComponentTypeNames = new Set([
    "FC",
    "FunctionComponent",
    "React.FC",
    "React.FunctionComponent",
]);

const forwardRefWrapperNames = new Set([
    "forwardRef",
    "React.forwardRef",
]);

function toPropInfo(
    propName: string,
    typeText: string,
    optional: boolean,
    defaultValue?: string
): PropInfo {
    return defaultValue === undefined
        ? {
            name: propName,
            type: typeText,
            optional,
        }
        : {
            name: propName,
            type: typeText,
            optional,
            defaultValue,
        };
}

function extractPropsFromType(
    type: Type,
    location: Node,
    defaultValues: Map<string, string>
): PropInfo[] {
    return type.getProperties().map(prop => {
        const declaration = prop.getDeclarations()[0];
        const propName = prop.getName();

        return toPropInfo(
            propName,
            declaration
                ? prop.getTypeAtLocation(declaration).getText()
                : prop.getTypeAtLocation(location).getText(),
            prop.isOptional(),
            defaultValues.get(propName)
        );
    });
}

function getBindingElementName(element: Node): string | undefined {
    if (!Node.isBindingElement(element)) {
        return undefined;
    }

    const propertyNameNode = element.getPropertyNameNode();
    const nameNode = propertyNameNode ?? element.getNameNode();

    return Node.isIdentifier(nameNode) || Node.isStringLiteral(nameNode)
        ? nameNode.getText().replace(/^["']|["']$/g, "")
        : undefined;
}

function getDestructuredDefaultValues(
    firstParam?: ParameterDeclaration
): Map<string, string> {
    const defaultValues = new Map<string, string>();
    const nameNode = firstParam?.getNameNode();

    if (!nameNode || !Node.isObjectBindingPattern(nameNode)) {
        return defaultValues;
    }

    for (const element of nameNode.getElements()) {
        const propName = getBindingElementName(element);
        const initializer = element.getInitializer();

        if (!propName || !initializer) {
            continue;
        }

        defaultValues.set(propName, initializer.getText());
    }

    return defaultValues;
}

function getPropsTypeFromFunctionComponentAnnotation(
    node: ComponentNode
): Type | undefined {
    if (!Node.isVariableDeclaration(node)) {
        return undefined;
    }

    const typeNode = node.getTypeNode();

    if (!typeNode || !Node.isTypeReference(typeNode)) {
        return undefined;
    }

    const typeName = typeNode.getTypeName().getText();
    const firstTypeArgument = typeNode.getTypeArguments()[0];

    return functionComponentTypeNames.has(typeName) && firstTypeArgument
        ? firstTypeArgument.getType()
        : undefined;
}

function getPropsTypeFromClassExtends(
    node: ComponentNode
): Type | undefined {
    if (!Node.isClassDeclaration(node)) {
        return undefined;
    }

    const firstTypeArgument = node.getExtends()?.getTypeArguments()[0];

    return firstTypeArgument?.getType();
}

function getInitializerExpression(node: ComponentNode): Node | undefined {
    if (Node.isVariableDeclaration(node)) {
        return node.getInitializer();
    }

    if (Node.isExportAssignment(node)) {
        return node.getExpression();
    }

    return undefined;
}

function findCallNamed(
    node: Node | undefined,
    names: Set<string>
): CallExpression | undefined {
    if (!node) {
        return undefined;
    }

    if (Node.isCallExpression(node) && names.has(getCallName(node))) {
        return node;
    }

    if (!Node.isCallExpression(node)) {
        return undefined;
    }

    for (const argument of node.getArguments()) {
        const match = findCallNamed(argument, names);

        if (match) {
            return match;
        }
    }

    return undefined;
}

function getPropsTypeFromForwardRef(
    node: ComponentNode
): Type | undefined {
    const forwardRefCall = findCallNamed(
        getInitializerExpression(node),
        forwardRefWrapperNames
    );
    const propsTypeArgument = forwardRefCall?.getTypeArguments()[1];

    return propsTypeArgument?.getType();
}

function extractPropsFromFallbackType(
    node: ComponentNode,
    defaultValues: Map<string, string>
): PropInfo[] {
    const propsType =
        getPropsTypeFromFunctionComponentAnnotation(node) ??
        getPropsTypeFromClassExtends(node) ??
        getPropsTypeFromForwardRef(node);

    return propsType
        ? extractPropsFromType(propsType, node, defaultValues)
        : [];
}

export function extractProps(
    firstParam?: ParameterDeclaration
): PropInfo[] {
    if (!firstParam) {
        return [];
    }

    return extractPropsFromType(
        firstParam.getType(),
        firstParam,
        getDestructuredDefaultValues(firstParam)
    );
}

export function extractComponentProps(
    node: ComponentNode,
    wrapperNames: Set<ComponentWrapperName>
): PropInfo[] {
    const firstParam = getComponentPropsParameter(node, wrapperNames);
    const defaultValues = getDestructuredDefaultValues(firstParam);
    const parameterProps = firstParam
        ? extractPropsFromType(firstParam.getType(), firstParam, defaultValues)
        : [];

    return parameterProps.length > 0
        ? parameterProps
        : extractPropsFromFallbackType(node, defaultValues);
}
