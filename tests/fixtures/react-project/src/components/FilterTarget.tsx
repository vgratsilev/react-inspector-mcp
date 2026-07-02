export interface FilterTargetProps {
  mode: "story" | "test";
}

export function FilterTarget(props: FilterTargetProps) {
  return <section>{props.mode}</section>;
}
