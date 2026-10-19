import {
  EGamePhase,
  IEventDispatcher,
  IPlayer,
  ISerializable,
  TListener,
  TPartialWithRequired,
  TStringifiedEnum,
  TUnsubscribe,
} from "@repo/types";
import { Board } from "../board/Board";
import { AVAILABLE_SHIPS } from "../constants";

const deserializeToken = Symbol("BattleShips");

type TBattleShipsEventsActions = "phase_changed" | "update";
const TAG = "BattleShips" as const;
type TBattleShipsEvents = {
  type: `${typeof TAG}:${TBattleShipsEventsActions}`;
};

/**
 * Represents BattleShips single game, serializable model.
 */
export class BattleShips
  implements ISerializable, IEventDispatcher<TBattleShipsEvents>
{
  #observers: Set<TListener<TBattleShipsEvents>> = new Set();

  private version: number = 1;
  private boards: Map<string, Board> = new Map();
  private players: Map<string, IPlayer> = new Map();
  private size: number = 10;
  private owner?: string;
  private maxPlayers: number = 2;
  private availableShips: readonly number[];

  private phase: TStringifiedEnum<EGamePhase>;

  constructor();
  constructor(size: number);
  constructor(size: number, availableShips: readonly number[]);
  /**
   * @private Used internally for deserialization. Do not use directly.
   * @param source
   * @param token
   */
  constructor(source: string, token: typeof deserializeToken);
  constructor(
    sizeOrSource: string | number = 10,
    availableShipsOrToken:
      readonly number[] | typeof deserializeToken = AVAILABLE_SHIPS,
  ) {
    this.availableShips = AVAILABLE_SHIPS;
    this.phase = EGamePhase.Waiting;
    if (typeof sizeOrSource === "number") {
      this.size = sizeOrSource;
      this.boards = new Map();
      if (
        Array.isArray(availableShipsOrToken) &&
        availableShipsOrToken.some((element) => typeof element !== "number")
      ) {
        this.availableShips = availableShipsOrToken;
      }
    } else {
      const token = availableShipsOrToken as typeof deserializeToken;
      if (sizeOrSource && token !== deserializeToken) {
        throw new Error(
          "Use BattleShips.deserialize() to create an instance.",
        );
      }

      if (sizeOrSource) {
        this.deserialize(sizeOrSource);
      } else {
        this.boards = new Map();
        this.size = 10;
      }
    }
  }

  /**
   * Add player to a game. This can be done only during `EGamePhase.Waiting` phase.
   * @param player player details
   * @returns `true` if the player was added
   */
  addPlayer(player: IPlayer): boolean {
    const playersCount = this.boards.size;
    const hasPlayers = playersCount > 0;
    if (
      this.phase === EGamePhase.Waiting &&
      playersCount < this.maxPlayers &&
      (!hasPlayers || !this.boards.has(player.id))
    ) {
      this.boards.set(player.id, new Board(this.size));
      const initiatedPlayer = this.#initPlayer(player);
      this.players.set(player.id, initiatedPlayer);
      if (!hasPlayers) {
        this.owner = player.id;
        initiatedPlayer.owner = true;
        this.players.set(player.id, initiatedPlayer);
      }

      if (this.boards.size === this.maxPlayers) {
        // transition to placement
        this.#setPhase(EGamePhase.Placement);
      }

      return true;
    }
    return false;
  }

  updatePlayer(modification: TPartialWithRequired<IPlayer, "id">): boolean {
    if (this.players.has(modification.id)) {
      const player = this.players.get(modification.id)!;

      this.players.set(modification.id, {
        ...player,
        ...modification,
      });

      return true;
    }
    return false;
  }

  removePlayer(playerId: string): boolean {
    const playersCount = this.boards.size;
    const hasPlayers = playersCount > 0;
    if (
      (this.phase === EGamePhase.Waiting ||
        this.phase === EGamePhase.Placement) &&
      hasPlayers &&
      this.players.has(playerId)
    ) {
      const result = this.players.delete(playerId);
      this.boards.delete(playerId);

      // change last player ownership
      if (this.players.size === 1) {
        const lastPlayer = Array.from(this.players.values()).at(0)!;
        lastPlayer.owner = true;
        this.players.set(lastPlayer.id, lastPlayer);

        if (this.phase === EGamePhase.Placement) {
          // transition to waiting
          this.#setPhase(EGamePhase.Waiting);
        }
      }

      return result;
    }

    return false;
  }





  #initPlayer(player: IPlayer): IPlayer {
    return {
      ...player,
      ready: false,
      active: true,
    };
  }
  #setPhase(phase: TStringifiedEnum<EGamePhase>) {
    this.phase = phase;
    // notify about phase change
    this._publish({ type: `${TAG}:phase_changed` });
  }

  getPhase(): TStringifiedEnum<EGamePhase> {
    return this.phase;
  }

  private deserialize(data: string): void {
    const parsed = JSON.parse(data, (key, value) => {
      if (key === "boards") {
        return new Map(
          value.map(
            ({ playerId, board }: { playerId: string; board: string }) => [
              playerId,
              Board.deserialize(board),
            ],
          ),
        );
      }
      if (key === "players") {
        return new Map(
          value.map(
            ({ playerId, player }: { playerId: string; player: string }) => [
              playerId,
              JSON.parse(player),
            ],
          ),
        );
      }
      return value;
    });
    this.boards = parsed.boards;
    this.size = parsed.size;
    this.phase = parsed.phase;
    this.owner = parsed.owner;
    this.maxPlayers = parsed.maxPlayers;
    this.availableShips = parsed.availableShips;
  }

  // IEventDispatcher

  // PROTECTED
  // IEventDispatcher
  protected _publish(event: TBattleShipsEvents) {
    // notify 'em all
    this.#observers.forEach((listener) => listener(event));
  }
  // PUBLIC
  // PUBLIC INTERFACE IMPLEMENTATIONS
  /**
   * @implements IEventDispatcher
   * @dispatches `BattleShips:update` event.
   */
  subscribe(listener: TListener<TBattleShipsEvents>): TUnsubscribe {
    if (!this.#observers.has(listener)) {
      this.#observers.add(listener);
      // update
      listener({ type: `${TAG}:update` });
    }

    return (): boolean => {
      return this.#observers.delete(listener);
    };
  }

  unsubscribe(listener: TListener<TBattleShipsEvents>): boolean {
    return this.#observers.delete(listener);
  }

  // ISerializable
  serialize(): string {
    return JSON.stringify({
      version: this.version,
      phase: this.phase,
      size: this.size,
      owner: this.owner,
      maxPlayers: this.maxPlayers,
      availableShips: this.availableShips,
      players: Array.from(this.players.entries()).map(([playerId, player]) => ({
        playerId,
        player: JSON.stringify(player),
      })),
      boards: Array.from(this.boards.entries()).map(([playerId, board]) => ({
        playerId,
        board: board.serialize(),
      })),
    });
  }

  static deserialize(data: string): BattleShips {
    return new BattleShips(data, deserializeToken);
  }
}
