import {
  EGamePhase,
  IEventDispatcher,
  IPlayer,
  ISerializable,
  TCellStatusShipId,
  TCellStatusShipDestroyedOffset,
  TCoordinate,
  THistoryEntry,
  TListener,
  TPartialWithRequired,
  TShip,
  TStringifiedEnum,
  TUnsubscribe,
  TCellStatusMiss,
  TCellStatusShipDestroyed,
  TCellStatusShipHit,
  TCellStatusShipHitOffset,
  TAttackHistory,
  TGameTimeStamps,
  TGameState,
  TCellStatusEmpty,
} from "@repo/types";
import { AVAILABLE_SHIPS } from "../constants";
import {
  BattleShipsBoard,
  isDestroyedShipStatus,
  isHitShipStatus,
  isShipStatus,
} from "../board/BattleShipsBoard";
import { isSunk } from "../board/isSunk";
import { getShip } from "../utils/getShip";

const hitOffset: TCellStatusShipHitOffset = 100;
const destroyOffset: TCellStatusShipDestroyedOffset = 1000;
const empty: TCellStatusEmpty = -1;

const deserializeToken = Symbol("BattleShips");

type TBattleShipsEventsActions =
  | "phase_changed"
  | "update"
  | "ships_placed"
  | "player_ready"
  | "error"
  | "attack_result";
const TAG = "BattleShips" as const;
type TBattleShipsEvents = {
  type: `${typeof TAG}:${TBattleShipsEventsActions}`;
  payload?: unknown;
};

/**
 * Represents BattleShips single game, serializable model.
 */
export class BattleShips
  implements ISerializable, IEventDispatcher<TBattleShipsEvents>
{
  #observers: Set<TListener<TBattleShipsEvents>> = new Set();

  private game_created: string;
  private game_started: string | null = null;
  private game_finished: string | null = null;

  private version: number = 1;
  private boards: Map<string, BattleShipsBoard> = new Map();
  private players: Map<string, IPlayer> = new Map();

  private size: number = 10;
  private owner?: string;
  private turn?: string;
  private history: THistoryEntry[] = [];
  private maxPlayers: number = 2;
  private availableShips: readonly number[];

  private phase: TStringifiedEnum<EGamePhase>;

  constructor();
  constructor(size: number);
  constructor(size: number, availableShips: readonly number[]);
  /**
   * @private Used internally for deserialization. Do not use directly. Use `BattleShips.deserialize()` instead.
   * @param source
   * @param token
   */
  constructor(source: string, token: typeof deserializeToken);
  constructor(
    sizeOrSource: string | number = 10,
    availableShipsOrToken:
      readonly number[] | typeof deserializeToken = AVAILABLE_SHIPS,
  ) {
    this.game_created = new Date().toISOString();
    this.availableShips = AVAILABLE_SHIPS;
    this.phase = EGamePhase.Waiting;
    if (typeof sizeOrSource === "number") {
      this.size = sizeOrSource;
      this.boards = new Map();
      if (Array.isArray(availableShipsOrToken)) {
        this.availableShips = [...availableShipsOrToken];
      }
    } else {
      const token = availableShipsOrToken as typeof deserializeToken;
      if (sizeOrSource && token !== deserializeToken) {
        throw new Error("Use BattleShips.deserialize() to create an instance.");
      }

      if (sizeOrSource) {
        this.deserialize(sizeOrSource);
      } else {
        this.boards = new Map();
        this.size = 10;
      }
    }
  }

  activatePlayer(playerId: string, flag = true): boolean {
    if (!this.players.has(playerId)) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message: `Player "${playerId}" does not exist.`,
        },
      });
      return false;
    }

    return this.updatePlayer({
      id: playerId,
      active: flag,
    });
  }

  getTimeStamps(): TGameTimeStamps {
    return {
      game_created: this.game_created,
      game_started: this.game_started,
      game_finished: this.game_finished,
    };
  }

  getGameState(
    playerId: string,
  ): Omit<
    TGameState,
    "id" | "name" | "battleResults" | "rematchRequest"
  > | null {
    if (!this.players.has(playerId) || !this.boards.has(playerId)) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message: `Player "${playerId}" does not exist.`,
        },
      });
      return null;
    }
    const enemy = structuredClone(this.getOpponent(playerId)!);
    const phase = this.getPhase();
    const myBoard = this.boards.get(playerId);
    const self = structuredClone(this.players.get(playerId)!);

    if (phase === EGamePhase.Waiting) {
      return {
        phase: EGamePhase.Waiting,
        game_created: this.game_created,
        game_finished: this.game_finished,
        game_started: this.game_started,
        result: this.getResult(),
        turn: this.getTurn()!,
        self,
        // TODO: remove never once TGameState sorted
        myBoard: (myBoard?.getBoard() as never) ?? [],
      };
    } else if (phase === EGamePhase.Placement) {
      const fleet = myBoard?.getFleet() ?? [];
      return {
        phase: EGamePhase.Placement,
        game_created: this.game_created,
        game_finished: this.game_finished,
        game_started: this.game_started,
        result: this.getResult(),
        turn: this.getTurn()!,
        self,
        enemy,
        myBoard: (myBoard?.getBoard() as never) ?? [],
        ships:
          fleet.length > 0 ? fleet : this.availableShips.map(toShipId(getShip)),
      } as Omit<TGameState, "id" | "name">;
    } else {
      const enemyBoard = this.boards.get(enemy.id);
      const enemyShips = enemyBoard?.getFleet() ?? [];

      if (phase === "finished") {
        return {
          phase: EGamePhase.Finished,
          game_created: this.game_created,
          game_finished: this.game_finished,
          game_started: this.game_started,
          result: this.getResult(),
          turn: this.getTurn()!,
          self,
          enemy,
          ships: myBoard?.getFleet() ?? [],
          myBoard: (myBoard?.getBoard() as never) ?? [],
          enemyBoard: (enemyBoard?.getBoard() as never) ?? [],
          enemyDestroyedShips: enemyShips,
        } as Omit<
          TGameState,
          "id" | "name" | "battleResults" | "rematchRequest"
        >;
      } else {
        const lastAttack = this.history.at(-1) as TAttackHistory | undefined;

        return {
          phase: EGamePhase.Playing,
          game_created: this.game_created,
          game_finished: this.game_finished,
          game_started: this.game_started,
          result: this.getResult(),
          turn: this.getTurn()!,
          self,
          enemy,
          myBoard: (myBoard?.getBoard() as never) ?? [],
          ships: myBoard?.getFleet() ?? [],
          enemyBoard: enemyBoard?.getBoard().map((row) => {
            return row.map((cell) => {
              // allow all but TCellStatusShipId <1..10>
              if (isShipStatus(cell)) {
                return empty;
              }
              return cell;
            });
          }) as never,
          enemyDestroyedShips: enemyShips.filter(isSunk),
          lastAttack:
            lastAttack && this.getTurn() === playerId ? lastAttack : undefined,
        } as Omit<
          TGameState,
          "id" | "name" | "battleResults" | "rematchRequest"
        >;
      }
    }
  }

  /**
   * Add player to a game. This can be done only during `EGamePhase.Waiting` phase.
   * @param player player details
   * @returns `true` if the player was added
   * @emits `BattleShips:phase_changed`
   * @emits `BattleShips:error`
   */
  addPlayer(player: Omit<IPlayer, "ready">): boolean {
    const playersCount = this.boards.size;
    const hasPlayers = playersCount > 0;
    if (
      this.phase === EGamePhase.Waiting &&
      playersCount < this.maxPlayers &&
      !this.boards.has(player.id)
    ) {
      this.boards.set(player.id, new BattleShipsBoard(this.size));
      const initiatedPlayer = initPlayer(player);
      this.players.set(player.id, initiatedPlayer);
      if (!hasPlayers) {
        this.owner = player.id;
        this.turn = player.id;
        initiatedPlayer.owner = true;
        this.players.set(player.id, initiatedPlayer);
      }

      if (this.boards.size === this.maxPlayers) {
        // transition to placement
        this.#setPhase(EGamePhase.Placement);
      }

      return true;
    }

    if (this.phase !== EGamePhase.Waiting) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message:
            "Invalid game phase. New player can be added ONLY during waiting phase.",
        },
      });
    } else if (this.boards.has(player.id)) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message: "Player already added.",
        },
      });
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

  /**
   *
   * @param playerId
   * @returns
   * @emits `BattleShips:phase_changed`
   * @emits `BattleShips:error`
   */
  removePlayer(playerId: string): boolean {
    const playersCount = this.boards.size;
    const hasPlayers = playersCount > 0;
    if (
      (this.phase === EGamePhase.Waiting ||
        this.phase === EGamePhase.Placement) &&
      hasPlayers &&
      this.players.has(playerId)
    ) {
      this.players.delete(playerId);
      this.boards.delete(playerId);

      // change last player ownership
      if (this.players.size === 1) {
        const lastPlayer = Array.from(this.players.values()).at(0)!;
        this.owner = lastPlayer.id;
        this.turn = lastPlayer.id;
        lastPlayer.owner = true;
        this.players.set(lastPlayer.id, lastPlayer);

        if (this.phase === EGamePhase.Placement) {
          // clear board
          this.boards.get(lastPlayer.id)?.clear();
          // transition to waiting
          this.#setPhase(EGamePhase.Waiting);
        }
      }
      return true;
    }

    if (
      this.phase !== EGamePhase.Waiting &&
      this.phase !== EGamePhase.Placement
    ) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message:
            "Invalid game phase. Player can be removed ONLY during waiting or placement phase.",
        },
      });
    } else if (!hasPlayers) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message: "No players to remove.",
        },
      });
    } else if (!this.players.has(playerId)) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message: `Player "${playerId}" does not exist.`,
        },
      });
    }

    return false;
  }

  /**
   *
   * @param playerId
   * @param ships
   * @returns
   * @emits `BattleShips:ships_placed`
   * @emits `BattleShips:player_ready`
   * @emits `BattleShips:phase_changed`
   * @emits `BattleShips:error`
   */
  placeShips(
    playerId: string,
    ships: (TShip & { type: "pending"; id: TCellStatusShipId })[],
  ): boolean {
    let player = this.players.get(playerId);
    const board = this.boards.get(playerId);
    const expectedLength = this.availableShips.length;

    if (
      ships.length === expectedLength &&
      player &&
      board &&
      this.phase === EGamePhase.Placement
    ) {
      // unroll point
      const waypoint = board.serialize();
      if (
        ships.some((ship) => {
          return !board.placeShip(ship, ship.coords, ship.orientation);
        })
      ) {
        // if any fails, rollback
        this.boards.set(playerId, BattleShipsBoard.deserialize(waypoint));
        this._publish({
          type: `${TAG}:error`,
          payload: {
            message: "Incorrectly placed ships.",
          },
        });
        //
      } else {
        // player ready
        this.updatePlayer({
          ...player,
          ready: true,
        });

        player = this.players.get(playerId);

        this._publish({ type: `${TAG}:ships_placed` });

        if (
          !Array.from(this.players.values()).some((needle) => !needle.ready)
        ) {
          this.history = [
            {
              init: true,
            },
          ];
          // all players are ready
          // timestamp
          this.game_started = new Date().toISOString();
          //
          this.#setPhase(EGamePhase.Playing);
        } else {
          // notify that player is ready
          this._publish({
            type: `${TAG}:player_ready`,
            payload: {
              ...player,
            },
          });
        }

        return true;
      }
    }
    if (this.phase !== EGamePhase.Placement) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message:
            "Invalid game phase. Ships can be added ONLY during placement phase.",
        },
      });
    } else if (ships.length !== expectedLength) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message: "Invalid number of ships to be placed.",
        },
      });
    } else if (!player || !board) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message: `Player "${playerId}" does not exist.`,
        },
      });
    }

    return false;
  }

  /**
   *
   * @param playerId
   * @param coords
   * @returns
   * @emits `BattleShips:phase_changed`
   * @emits `BattleShips:attack_result`
   * @emits `BattleShips:error`
   */
  attack(playerId: string, coords: TCoordinate) {
    const player = this.players.get(playerId);

    if (
      this.phase === EGamePhase.Playing &&
      player &&
      this.#validTurn(playerId)
    ) {
      const opponent = this.getOpponent(player.id);
      // console.log("opponent", opponent);
      if (opponent) {
        const board = this.boards.get(opponent.id);
        // console.log("board", board);
        if (board) {
          const result = board.resolveAttack(coords);
          const shipId = normalizeShipId(result);
          const ship = shipId === 0 ? undefined : board.getShipById(shipId);
          const isSunk = result > destroyOffset;
          const historyEntry: THistoryEntry = {
            coords,
            isSunk,
            result,
            turn: playerId,
            size: isSunk ? (ship?.size ?? 0) : 0,
          };

          this.history.push(historyEntry);

          this._publish({
            type: `${TAG}:attack_result`,
            payload: result,
          });

          if (board.fleetDestroyed()) {
            console.log("Finished", this.turn);

            this.history.push({
              finish: true,
              whoWon: this.turn!,
            });

            this.game_finished = new Date().toISOString();

            this.#setPhase(EGamePhase.Finished);
          } else {
            // change turn
            this.turn = opponent.id;
          }
          // shot fired
          return result;
        }
      }
    }

    if (this.phase !== EGamePhase.Playing) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message:
            "Invalid game phase. Player can attack ONLY during playing phase.",
        },
      });
    } else if (!this.#validTurn(playerId)) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message: "Not your turn.",
        },
      });
    } else if (!player) {
      this._publish({
        type: `${TAG}:error`,
        payload: {
          message: `Player "${playerId}" does not exist.`,
        },
      });
    }

    return 0;
  }

  forfeit(forfeitingPlayerId: string): boolean {
    if (
      this.getPhase() === EGamePhase.Playing &&
      this.players.has(forfeitingPlayerId)
    ) {
      // Implementation for forfeiting logic
      const loser = this.getPlayer(forfeitingPlayerId);
      const winner = this.getOpponent(forfeitingPlayerId);

      if (loser?.active && winner?.active) {
        this.history.push({
          finish: true,
          whoWon: winner.id,
          byForfeit: true
        });
        this.game_finished = new Date().toISOString();
        // deactivate losing side
        this.updatePlayer({
          id: loser.id,
          active: false,
        });
        //
        this.#setPhase(EGamePhase.Finished);

        return true;
      }
    }
    return false;
  }

  getResult(): Record<string, "win" | "lost"> {
    if (this.getPhase() === EGamePhase.Finished) {
      return Array.from(this.players.values()).reduce((result, player) => {
        if (this.boards.has(player.id)) {
          return {
            ...result,
            [player.id]: !this.boards.get(player.id)?.fleetDestroyed()
              ? "win"
              : "lost",
          };
        }
        return result;
      }, {});
    }
    return {};
  }

  getPhase(): TStringifiedEnum<EGamePhase> {
    return this.phase;
  }
  getTurn(): string | undefined {
    return this.turn;
  }

  getPlayer(playerId: string): IPlayer | undefined {
    const player = this.players.get(playerId);
    if (player) {
      return structuredClone(player);
    }
    return undefined;
  }
  getOpponent(ofPlayerId: string): IPlayer | undefined {
    const player = this.players.get(ofPlayerId);
    if (player) {
      const other = Array.from(this.players.values()).find(
        (needle) => needle.id !== player.id,
      );
      return structuredClone(other);
    }
    return undefined;
  }

  getPlayersCount() {
    return this.players.size;
  }

  #validTurn(playerId: string): boolean {
    return this.turn === playerId;
  }

  #setPhase(phase: TStringifiedEnum<EGamePhase>) {
    this.phase = phase;
    // notify about phase change
    this._publish({ type: `${TAG}:phase_changed` });
  }

  private deserialize(data: string): void {
    const parsed = JSON.parse(data, (key, value) => {
      if (key === "boards") {
        return new Map(
          value.map(
            ({ playerId, board }: { playerId: string; board: string }) => [
              playerId,
              BattleShipsBoard.deserialize(board),
            ],
          ),
        );
      }
      if (key === "players") {
        return new Map(
          value.map(
            ({ playerId, player }: { playerId: string; player: IPlayer }) => [
              playerId,
              player,
            ],
          ),
        );
      }
      return value;
    }) as IDeserializedBattleShips;

    this.boards = parsed.boards;
    this.players = parsed.players;
    this.size = parsed.size;
    this.phase = parsed.phase;
    this.owner = parsed.owner;
    this.turn = parsed.turn;
    this.maxPlayers = parsed.maxPlayers;
    this.availableShips = parsed.availableShips;
    this.history = parsed.history;
    this.game_created = parsed.game_created;
    this.game_finished = parsed.game_finished;
    this.game_started = parsed.game_started;
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
      game_created: this.game_created,
      game_finished: this.game_finished,
      game_started: this.game_started,
      phase: this.phase,
      size: this.size,
      owner: this.owner,
      turn: this.turn,
      maxPlayers: this.maxPlayers,
      availableShips: this.availableShips,
      players: Array.from(this.players.entries()).map(([playerId, player]) => ({
        playerId,
        player,
      })),
      boards: Array.from(this.boards.entries()).map(([playerId, board]) => ({
        playerId,
        board: board.serialize(),
      })),
      history: this.history,
    });
  }

  static deserialize(data: string): BattleShips {
    return new BattleShips(data, deserializeToken);
  }
}

interface IDeserializedBattleShips {
  version: number;
  game_created: string;
  game_finished: string | null;
  game_started: string | null;
  phase: EGamePhase;
  size: number;
  owner?: string;
  turn?: string;
  maxPlayers: number;
  availableShips: readonly number[];
  history: TAttackHistory[];
  players: Map<string, IPlayer>;
  boards: Map<string, BattleShipsBoard>;
}

function normalizeShipId(
  hitStatus: TCellStatusMiss | TCellStatusShipHit | TCellStatusShipDestroyed,
): TCellStatusMiss | TCellStatusShipId {
  if (isHitShipStatus(hitStatus)) {
    return (hitStatus - hitOffset) as TCellStatusShipId;
  }
  if (isDestroyedShipStatus(hitStatus)) {
    return (hitStatus - destroyOffset) as TCellStatusShipId;
  }
  return hitStatus;
}

function initPlayer(player: Omit<IPlayer, "ready">): IPlayer {
  return {
    ...player,
    ready: false,
    active: true,
  };
}

function toShipId(fn: typeof getShip) {
  return (shipSize: number, index: number) => {
    return fn(shipSize, index + 1);
  };
}
