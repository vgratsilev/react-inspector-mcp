import { Button, Icon, LazyPanel, MemoBadge } from "@ui";

export const Dashboard = () => {
  return (
    <section>
      <Icon />
      <MemoBadge label="Active" />
      <LazyPanel />
      <Button title="Open" variant="primary" />
    </section>
  );
};
