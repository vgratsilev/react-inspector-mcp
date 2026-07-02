interface ForwardInputProps {
  value: string;
}

declare function forwardRef<T>(value: T): T;

export const ForwardInput = forwardRef((
  props: ForwardInputProps,
  ref: unknown
) => {
  return <input ref={ref} value={props.value} />;
});
