export interface ButtonProps {
  title: string;
  disabled?: boolean;
  variant: "primary" | "secondary";
}

/**
 * Shared action button.
 */
export function Button(props: ButtonProps) {
  return (
    <button disabled={props.disabled} title={props.title}>
      {props.title}
    </button>
  );
}
