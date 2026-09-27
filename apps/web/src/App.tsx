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
import { SplashScreen } from "./pages/SplashScreen";
import { GameWaiting } from "./pages/GameWaiting";

function App() {
  useSocketConnection();
  useSocketGameState();
  useOpenGamesStatus();

  const { connected, clientSession } = useConnectionStatus();
  console.log("clientSession", clientSession);
  const { gameState, selfId } = useGameStore();
  console.log("[App]", gameState);

  const page = useMemo(() => {
    if (connected) {
      if (selfId && gameState) {
        const phase = gameState.phase;
        if (phase === "waiting") {
          return "game-waiting" as const;
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
    } else {
      return "init" as const;
    }
  }, [connected, gameState, selfId]);

  return (
    <>
      {page === "init" && <SplashScreen />}
      {page === "lobby" && <Lobby />}
      {page === "game-waiting" && <GameWaiting />}
      {page === "game-placement" && <GamePlacement />}
      {page === "game" && <Game />}
      {page === "game-over" && <GameOver />}
    </>
  );
}

export default App;
