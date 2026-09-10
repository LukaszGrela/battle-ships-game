import styles from "./OpenGames.module.css";

import { TRoomIdentity } from "@repo/types";
import { useOpenGamesStore } from "../../store/useOpenGamesStore";
import { Ribbon } from "../Ribbon/Ribbon";
import { FC, PropsWithChildren, useCallback } from "react";
import { socket } from "../../socket";
import { Button } from "../Button/Button";

export const OpenGames = () => {
  const { openGames } = useOpenGamesStore();
  return (
    <div className={styles.OpenGames}>
      <h3>
        <Ribbon className={styles.headerRibbon}>Open games</Ribbon>
      </h3>
      <div className={styles.OpenGames_container}>
        {openGames.length > 0 && (
          <ul className={styles.list}>
            {openGames.map((warRoomName: TRoomIdentity) => (
              <li key={warRoomName.id} className={styles.listItem}>
                <span className={styles.listItem_name}>{warRoomName.name}</span>
                <span className={styles.listItem_date}>
                  {new Date(warRoomName.game_created).toDateString()}
                </span>
                <span className={styles.listItem_action}>
                  <EmitJoinGameButton room={warRoomName}>
                    Join game
                  </EmitJoinGameButton>
                </span>
              </li>
            ))}
          </ul>
        )}
        {!openGames.length && <div>No open games available. Create Game.</div>}
      </div>
    </div>
  );
};

const EmitJoinGameButton: FC<
  PropsWithChildren<{
    disabled?: boolean;
    room?: string | TRoomIdentity;
  }>
> = ({ disabled, children = "Create Game", room }) => {
  const joinGame = useCallback(() => {
    if (room) socket.emit("join_game", room);
  }, [room]);
  return (
    <Button onClick={joinGame} disabled={disabled}>
      {children}
    </Button>
  );
};
