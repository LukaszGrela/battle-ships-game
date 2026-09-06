import { FC } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";

export const GameOver: FC = () => {
  return (
    <AppLayout>
      <h2>Game Over</h2>
      <section>
        <span>Win</span>
        <span>Lost</span>
      </section>
    </AppLayout>
  );
};
