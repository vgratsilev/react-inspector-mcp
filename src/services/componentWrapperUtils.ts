import {
    ArrowFunction,
    CallExpression,
    FunctionExpression,
    Node,
} from "ts-morph";

export type ComponentFunction = ArrowFunction | FunctionExpression;

export const DEFAULT_COMPONENT_WRAPPERS = [
    "memo",
    "React.memo",
    "forwardRef",
    "React.forwardRef",
] as const;

export type ComponentWrapperName =
    | (typeof DEFAULT_COMPONENT_WRAPPERS)[number]
    | string;

export function createComponentWrapperSet(
    customWrappers: string[] = []
): Set<ComponentWrapperName> {
    return new Set([
        ...DEFAULT_COMPONENT_WRAPPERS,
        ...customWrappers
            .map(wrapper => wrapper.trim())
            .filter(wrapper => wrapper.length > 0),
    ]);
}

export function getCallName(
    callExpression: CallExpression
): string {
    return callExpression.getExpression().getText();
}

function unwrapParenthesizedExpression(node: Node): Node {
    let current = node;

    while (Node.isParenthesizedExpression(current)) {
        current = current.getExpression();
    }

    return current;
}

export function isSupportedComponentWrapperCall(
    node: Node,
    wrapperNames: Set<ComponentWrapperName>
): node is CallExpression {
    return Node.isCallExpression(node) &&
        wrapperNames.has(getCallName(node));
}

export function unwrapComponentFunction(
    node: Node,
    wrapperNames: Set<ComponentWrapperName>
): ComponentFunction | undefined {
    const current = unwrapParenthesizedExpression(node);

    if (
        Node.isArrowFunction(current) ||
        Node.isFunctionExpression(current)
    ) {
        return current;
    }

    if (!isSupportedComponentWrapperCall(current, wrapperNames)) {
        return undefined;
    }

    const firstArgument = current.getArguments()[0];

    return firstArgument
        ? unwrapComponentFunction(firstArgument, wrapperNames)
        : undefined;
}

export function hasComponentWrapper(
    node: Node,
    wrapperNames: Set<ComponentWrapperName>
): boolean {
    const current = unwrapParenthesizedExpression(node);

    return isSupportedComponentWrapperCall(current, wrapperNames);
}
