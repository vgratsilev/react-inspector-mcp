import { Card as ProductCard } from "../feature-a/index.js";
import { Card as DirectFeatureBCard } from "../feature-b/Card.js";
import { FeatureBCard as MarketingCard } from "../feature-b/reexports.js";

export const SameNameDashboard = () => {
  return (
    <section>
      <ProductCard />
      <MarketingCard />
      <DirectFeatureBCard />
      <MissingWidget />
    </section>
  );
};
