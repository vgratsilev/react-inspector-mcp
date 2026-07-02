import { Button as Btn, ForwardInput } from "@ui";

export const Home = () => {
  const buttons = [Btn];

  return (
    <main>
      <Btn title="Save" variant="primary" />
      <Btn title="Cancel" disabled={false} variant="secondary"></Btn>
      <ForwardInput value="query" />
      {buttons.length}
    </main>
  );
};
