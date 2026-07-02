interface NestedMemoForwardRefProps {
  label: string;
  disabled?: boolean;
}

interface ReactNestedMemoForwardRefProps {
  title: string;
}

interface MixedMemoForwardRefProps {
  value: string;
}

interface MixedReactMemoForwardRefProps {
  name: string;
}

declare function memo<T>(value: T): T;
declare function forwardRef<T>(value: T): T;
declare function withSomething<T>(value: T): T;

declare const React: {
  memo<T>(value: T): T;
  forwardRef<T>(value: T): T;
};

export const NestedMemoForwardRef = memo(forwardRef((
  props: NestedMemoForwardRefProps,
  ref: unknown
) => {
  return <button disabled={props.disabled} ref={ref}>{props.label}</button>;
}));

export const ReactNestedMemoForwardRef = React.memo(React.forwardRef((
  props: ReactNestedMemoForwardRefProps,
  ref: unknown
) => {
  return <span ref={ref}>{props.title}</span>;
}));

export const MixedMemoForwardRef = memo(React.forwardRef((
  props: MixedMemoForwardRefProps,
  ref: unknown
) => {
  return <input ref={ref} value={props.value} />;
}));

export const MixedReactMemoForwardRef = React.memo(forwardRef((
  props: MixedReactMemoForwardRefProps,
  ref: unknown
) => {
  return <span ref={ref}>{props.name}</span>;
}));

export const PlainUppercaseUtility = () => "not a component";

export const WrappedPlainUtility = withSomething(() => {
  return <span>not a supported component wrapper</span>;
});
