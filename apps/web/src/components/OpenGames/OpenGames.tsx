import styles from "./OpenGames.module.css";

import { TRoomIdentity } from "@repo/types";
import { useOpenGamesStore } from "../../store/useOpenGamesStore";
import { FC, useCallback } from "react";
import { socket } from "../../socket";
import { Button } from "../Button/Button";
import { classNames } from "../../utils/classNames";
import { DecoratedContainer } from "../DecoratedContainer";
import { Swords } from "../icons/Swords";
import { TButtonProps } from "../Button/types";

export const OpenGames: FC<{ className?: string }> = ({ className }) => {
  const { openGames } = useOpenGamesStore();
  return (
    <DecoratedContainer
      className={classNames(styles.OpenGames, className)}
      header={<span className={"shadow"}>Open games</span>}
    >
      {openGames.length > 0 && (
        <ul className={styles.list}>
          {openGames.map((warRoomName: TRoomIdentity) => (
            <li key={warRoomName.id} className={styles.listItem}>
              <div className={styles.listItem_name}>{warRoomName.name}</div>
              <div className={styles.listItem_date}>
                {warRoomName.game_created
                  ? new Date(warRoomName.game_created).toDateString()
                  : ""}
              </div>
              <div className={styles.listItem_action}>
                <div className={styles.listItem_action_content}>
                  <EmitJoinGameButton
                    room={warRoomName}
                    className={styles.joinGame}
                  >
                    <Swords />
                    <span>Join game</span>
                  </EmitJoinGameButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!openGames.length && (
        <div className={styles.empty}>
          No open games to join available. Create a new Game.
        </div>
      )}
    </DecoratedContainer>
  );
};

const EmitJoinGameButton: FC<
  Omit<TButtonProps, "onClick"> & {
    room?: string | TRoomIdentity;
  }
> = ({ disabled, children = "Create Game", room, ...props }) => {
  const joinGame = useCallback(() => {
    if (room) socket.emit("join_game", room);
  }, [room]);
  return (
    <Button onClick={joinGame} disabled={disabled} {...props}>
      {children}
    </Button>
  );
};
