import { useConnectionStatus } from "../../store/useConnectionStatus";

export const ConnectionStatus = () => {
  const { connected } = useConnectionStatus();
  return (
    <div>
      Connected to game server: {connected ? "CONNECTED" : "DISCONNECTED"}
    </div>
  );
};
