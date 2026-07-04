import { Node } from "ts-morph";

function unwrapParenthesizedExpression(node: Node): Node {
    let current = node;

    while (Node.isParenthesizedExpression(current)) {
        current = current.getExpression();
    }

    return current;
}

function isStyledFactoryTag(node: Node): boolean {
    const text = node.getText();

    return (
        text === "styled" ||
        text.startsWith("styled.") ||
        text.startsWith("styled(")
    );
}

export function isStyledComponentExpression(node: Node): boolean {
    const current = unwrapParenthesizedExpression(node);

    return Node.isTaggedTemplateExpression(current) &&
        isStyledFactoryTag(current.getTag());
}
