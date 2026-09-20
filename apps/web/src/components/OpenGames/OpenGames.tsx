import styles from "./OpenGames.module.css";

import { TRoomIdentity } from "@repo/types";
import { useOpenGamesStore } from "../../store/useOpenGamesStore";
import { FC, PropsWithChildren, useCallback } from "react";
import { socket } from "../../socket";
import { Button } from "../Button/Button";
import { classNames } from "../../utils/classNames";
import { DecoratedContainer } from "../DecoratedContainer";

export const OpenGames: FC<{ className?: string }> = ({ className }) => {
  const { openGames } = useOpenGamesStore();
  return (
    <DecoratedContainer
      className={classNames(styles.OpenGames, className)}
      header={<span className={styles.shadow}>Open games</span>}
    >
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
      {!openGames.length && (
        <div className={styles.empty}>
          No open games available. Create a Game.
        </div>
      )}
    </DecoratedContainer>
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
