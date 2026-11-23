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
import { ServerRestartScreen } from "./pages/ServerRestartScreen";
import { RestoredToast } from "./components/RestoredToast/RestoredToast";

function App() {
  useSocketConnection();
  useSocketGameState();
  useOpenGamesStatus();

  const { connected, phase } = useConnectionStatus();
  const { gameState, selfId } = useGameStore();

  const page = useMemo(() => {
    // A planned shutdown owns the whole screen, even while the socket is still
    // up for a few more milliseconds.
    if (phase === "server-restarting") {
      return "server-restarting" as const;
    }
    if (connected) {
      if (selfId && gameState) {
        const gamePhase = gameState.phase;
        if (gamePhase === "waiting") {
          return "game-waiting" as const;
        }
        if (gamePhase === "placement") {
          return "game-placement";
        }
        if (gamePhase === "finished") {
          return "game-over";
        }
        // playing
        return "game" as const;
      }
      return "lobby" as const;
    } else {
      return "init" as const;
    }
  }, [connected, gameState, selfId, phase]);

  return (
    <>
      {page === "server-restarting" && <ServerRestartScreen />}
      {page === "init" && <SplashScreen />}
      {page === "lobby" && <Lobby />}
      {page === "game-waiting" && <GameWaiting />}
      {page === "game-placement" && <GamePlacement />}
      {page === "game" && <Game />}
      {page === "game-over" && <GameOver />}
      <RestoredToast />
    </>
  );
}

export default App;
