import { MemoBadge } from "@ui";

export interface AppShellProps {
  title: string;
  compact?: boolean;
}

/**
 * Application shell used by app routes.
 */
export function AppShell(props: AppShellProps) {
  return (
    <section>
      <MemoBadge label={props.title} />
      <span>{props.compact ? "Compact" : "Full"}</span>
    </section>
  );
}

function LayoutWatermark() {
  return <span>Internal</span>;
}

export default function RootLayout() {
  return (
    <section>
      <AppShell title="React Inspector" compact />
      <LayoutWatermark />
    </section>
  );
}
