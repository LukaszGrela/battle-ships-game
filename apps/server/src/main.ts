import { createGameServer } from "./server.js";
import { getReconnectTimeoutMs } from "./utils/reconnectGrace.js";

const PORT = 3001;
const { httpServer } = createGameServer();

// io.listen(PORT);
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(
    "Battleship Game Server on",
    "0.0.0.0:",
    PORT,
    "reconnect timeout:",
    getReconnectTimeoutMs(),
  );
});
