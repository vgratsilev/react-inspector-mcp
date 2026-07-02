import { Dashboard } from "@ui/Dashboard.js";
import { Card as MarketingCard } from "@features/b";

export function DashboardPage() {
  return (
    <main>
      <Dashboard />
      <MarketingCard />
    </main>
  );
}
