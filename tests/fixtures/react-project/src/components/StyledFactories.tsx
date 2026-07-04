interface StyledTag {
  (strings: TemplateStringsArray, ...values: unknown[]): () => JSX.Element;
  attrs(attrs: Record<string, unknown>): StyledTag;
}

declare const styled: {
  div: StyledTag;
  button: StyledTag;
  <T>(component: T): StyledTag;
};

export const StyledBox = styled.div`
  display: block;
`;

export const StyledWrappedBox = styled(StyledBox)`
  padding: 4px;
`;

export const StyledAttrsButton = styled.button.attrs({
  type: "button",
})`
  border: 0;
`;
