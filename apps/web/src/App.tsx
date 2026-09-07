import { useMemo } from "react";
import {
  useConnectionStatus,
  useSocketConnection,
} from "./store/useConnectionStatus";
import { useGameStore, useSocketGameState } from "./store/useGameStore";
import { Lobby } from "./pages/Lobby";
import { useOpenGamesStatus } from "./store/useOpenGamesStore";
import { GameOver } from "./pages/GameOver";
import { Game } from "./pages/Game";
import { GamePlacement } from "./pages/GamePlacement";

function App() {
  useSocketConnection();
  useSocketGameState();
  useOpenGamesStatus();

  const { connected } = useConnectionStatus();
  const { gameState, selfId } = useGameStore();
  console.log(gameState);

  const page = useMemo(() => {
    if (connected && selfId && gameState) {
      const phase = gameState.phase;
      if (phase === "waiting") {
        return "game";
      }
      if (phase === "placement") {
        return "game-placement";
      }
      if (phase === "finished") {
        return "game-over";
      }
      // playing
      return "game" as const;
    }
    return "lobby" as const;
  }, [connected, gameState, selfId]);

  return (
    <>
      {page === "lobby" && <Lobby />}
      {page === "game-placement" && <GamePlacement />}
      {page === "game" && <Game />}
      {page === "game-over" && <GameOver />}
    </>
  );
}

export default App;
