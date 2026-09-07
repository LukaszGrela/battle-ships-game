import { FC, PropsWithChildren } from "react";
import { ConnectionStatus } from "../ConnectionStatus/ConnectionStatus";
import { socket, useSocket } from "../../socket";
import { useGameStore } from "../../store/useGameStore";

export const AppLayout: FC<PropsWithChildren<{}>> = ({ children }) => {
  return (
    <main className="AppLayout">
      <header>
        <h1>Battleships</h1>
        <ConnectionStatus />
        <Disconnect />
        <EmitLeaveGameButton />
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

const EmitLeaveGameButton: FC<PropsWithChildren<{}>> = ({
  children = "Leave Game",
}) => {
  const { selfId } = useGameStore();
  const leaveGame = () => {
    socket.emit("leave_game");
  };
  return (
    <button onClick={leaveGame} disabled={!!selfId === false}>
      {children}
    </button>
  );
};
