import {
    ArrowFunction,
    CallExpression,
    FunctionExpression,
    Node,
} from "ts-morph";

export type ComponentFunction = ArrowFunction | FunctionExpression;

export const SUPPORTED_COMPONENT_WRAPPERS = [
    "memo",
    "React.memo",
    "forwardRef",
    "React.forwardRef",
] as const;

type SupportedComponentWrapper =
    (typeof SUPPORTED_COMPONENT_WRAPPERS)[number];

const supportedWrapperNames = new Set<string>(
    SUPPORTED_COMPONENT_WRAPPERS
);

function isSupportedComponentWrapperName(
    name: string
): name is SupportedComponentWrapper {
    return supportedWrapperNames.has(name);
}

function getCallName(
    callExpression: CallExpression
): SupportedComponentWrapper | undefined {
    const expression = callExpression.getExpression();

    if (Node.isIdentifier(expression)) {
        const name = expression.getText();

        return isSupportedComponentWrapperName(name)
            ? name
            : undefined;
    }

    if (Node.isPropertyAccessExpression(expression)) {
        const owner = expression.getExpression();

        if (!Node.isIdentifier(owner)) {
            return undefined;
        }

        const name = `${owner.getText()}.${expression.getName()}`;

        return isSupportedComponentWrapperName(name)
            ? name
            : undefined;
    }

    return undefined;
}

function unwrapParenthesizedExpression(node: Node): Node {
    let current = node;

    while (Node.isParenthesizedExpression(current)) {
        current = current.getExpression();
    }

    return current;
}

export function isSupportedComponentWrapperCall(
    node: Node
): node is CallExpression {
    return Node.isCallExpression(node) && getCallName(node) !== undefined;
}

export function unwrapComponentFunction(
    node: Node
): ComponentFunction | undefined {
    const current = unwrapParenthesizedExpression(node);

    if (
        Node.isArrowFunction(current) ||
        Node.isFunctionExpression(current)
    ) {
        return current;
    }

    if (!isSupportedComponentWrapperCall(current)) {
        return undefined;
    }

    const firstArgument = current.getArguments()[0];

    return firstArgument
        ? unwrapComponentFunction(firstArgument)
        : undefined;
}
