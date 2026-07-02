import { Button, ForwardInput } from "@ui";
import { Card as ProductCard } from "@features/a";
import { Card as MarketingCard } from "@features/b";

export default function AppHomePage() {
  return (
    <main>
      <Button title="Launch" variant="primary" />
      <ForwardInput value="app search" />
      <ProductCard />
      <MarketingCard />
    </main>
  );
}
