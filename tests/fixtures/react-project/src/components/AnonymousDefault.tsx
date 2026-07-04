interface AnonymousDefaultProps {
  label?: string;
}

export default (
  {
    label = "Generated",
  }: AnonymousDefaultProps
) => <span>{label}</span>;
