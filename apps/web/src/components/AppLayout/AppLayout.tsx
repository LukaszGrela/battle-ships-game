import { FC, PropsWithChildren } from "react";
import { ConnectionStatus } from "../ConnectionStatus/ConnectionStatus";
import { useSocket } from "../../socket";

export const AppLayout: FC<PropsWithChildren<{}>> = ({ children }) => {
  return (
    <main className="AppLayout">
      <header>
        <h1>Battleships</h1>
        <ConnectionStatus />
        <Disconnect />
      </header>
      <nav></nav>
      <section>{children}</section>
    </main>
  );
};

const Disconnect = () => {
  const { disconnect } = useSocket();
  return (
    <section>
      <button onClick={disconnect}>Disconnect</button>
    </section>
  );
};
