interface ConfiguredHocPanelProps {
  status: string;
}

declare function arbitraryHoc<T>(value: T): T;
declare function unconfiguredHoc<T>(value: T): T;

export const ConfiguredHocPanel = arbitraryHoc((
  props: ConfiguredHocPanelProps
) => {
  return <span>{props.status}</span>;
});

export const UnconfiguredHocPanel = unconfiguredHoc(() => {
  return <span>Hidden without componentWrappers</span>;
});
