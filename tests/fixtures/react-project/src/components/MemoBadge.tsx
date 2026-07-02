interface MemoBadgeProps {
  label: string;
}

declare function memo<T>(value: T): T;

export const MemoBadge = memo((props: MemoBadgeProps) => {
  return <span>{props.label}</span>;
});
