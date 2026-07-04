declare namespace React {
  type FC<P = Record<string, unknown>> = (props: P) => JSX.Element;
}

type FC<P = Record<string, unknown>> = (props: P) => JSX.Element;

interface FcPanelProps {
  label: string;
  count?: number;
}

interface AliasFcPanelProps {
  title: string;
}

interface GenericPanelProps {
  title: string;
  tone?: "info" | "danger";
}

interface GenericForwardRefProps {
  value: string;
  disabled?: boolean;
}

declare function forwardRef<TRef, TProps>(
  render: (props: TProps, ref: TRef) => JSX.Element
): (props: TProps) => JSX.Element;

export const FcPanel: React.FC<FcPanelProps> = ({
  label,
  count = 1,
}) => {
  return <span>{label}:{count}</span>;
};

export const AliasFcPanel: FC<AliasFcPanelProps> = (props) => {
  return <span>{props.title}</span>;
};

export function GenericPanel<TProps extends GenericPanelProps>(
  props: TProps
) {
  return <section>{props.title}</section>;
}

export const GenericForwardRef = forwardRef<
  HTMLInputElement,
  GenericForwardRefProps
>(({
  value,
  disabled = false,
}, ref) => {
  return <input ref={ref} value={value} disabled={disabled} />;
});
