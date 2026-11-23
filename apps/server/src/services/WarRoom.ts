import { AVAILABLE_SHIPS } from "@repo/game-logic";
import { BattleShips } from "@repo/game-logic/src/game/BattleShips";
import {
  EGamePhase,
  IPlayer,
  ISerializable,
  TCellStatus,
  TCellStatusShipId,
  TCoordinate,
  TGameState,
  TGameTimeStamps,
  TRematchRequest,
  TShip,
  TStringifiedEnum,
} from "@repo/types";

import { REMATCH_REQUEST_TIMEOUT_MS } from "../config/rematch";
import { createId } from "../utils/createId";

const deserializeToken = Symbol("WarRoom");

const EMPTY_TIMESTAMP: TGameTimeStamps = {
  game_created: null,
  game_started: null,
  game_finished: null,
};

/**
 * Encapsulates active game identifier (room id and room name).
 * - Holds current's game state.
 * - Holds list of previous games states (rematch).
 * - provides per player game state
 *
 * Starts with an owner user (first to join while creating new room).
 */
export class WarRoom implements ISerializable {
  private version = 1;
  private currentGame?: BattleShips;
  private battles: BattleShips[] = [];

  #rematchRequest?: TRematchRequest;
  #id: string;
  #name: string;

  constructor(id: string, name: string, player: IPlayer);
  /**
   * @private Used internally for deserialization. Do not use directly. Use `BattleShips.deserialize()` instead.
   * @param source
   * @param token
   */
  constructor(source: string, token: typeof deserializeToken);
  constructor(
    idOrSource: string,
    nameOrToken: string | typeof deserializeToken,
    player?: IPlayer,
  ) {
    if (typeof nameOrToken === "string") {
      this.#id = idOrSource;
      this.#name = nameOrToken;
      if (!player) {
        throw new Error("Invalid or missing player");
      }
      this.currentGame = new BattleShips(10, AVAILABLE_SHIPS);
      this.addPlayer(player);
    } else {
      // deserialization
      if (nameOrToken !== deserializeToken) {
        throw new Error("Use WarRoom.deserialize() to create an instance.");
      }
      this.#id = "not-set";
      this.#name = "not-set";
      this.deserialize(idOrSource);
    }
  }

  getOwner(): IPlayer | undefined {
    return this.currentGame?.getOwner();
  }
  addPlayer(player: IPlayer): boolean {
    return !!this.currentGame?.addPlayer(player);
  }
  removePlayer(playerId: string): boolean {
    return !!this.currentGame?.removePlayer(playerId);
  }

  activatePlayer(playerId: string): boolean {
    if (this.currentGame) {
      return this.currentGame.activatePlayer(playerId);
    }
    return false;
  }
  deactivatePlayer(playerId: string): boolean {
    if (this.currentGame) {
      return this.currentGame.activatePlayer(playerId, false);
    }
    return false;
  }

  getTimeStamps(): TGameTimeStamps {
    return this.currentGame?.getTimeStamps() ?? EMPTY_TIMESTAMP;
  }

  getPhase(): TStringifiedEnum<EGamePhase> | undefined {
    return this.currentGame?.getPhase();
  }

  getTurn(): String | undefined {
    return this.currentGame?.getTurn();
  }

  getGameState(playerId: string): TGameState | null {
    const currentGameState = this.currentGame?.getGameState(playerId);
    if (currentGameState) {
      const state = {
        ...currentGameState,
        id: this.#id,
        name: this.#name,
      } as TGameState;

      if (state.phase !== EGamePhase.Waiting) {
        state.battleResults = this.battles.reduce(
          (acc, battle) => {
            Object.entries(battle.getResult()).forEach(([playerId, result]) => {
              acc[playerId] = (acc[playerId] ?? 0) + (result === "win" ? 1 : 0);
            });

            return acc;
          },
          {} as Record<string, number>,
        );
      }
      if (state.phase === EGamePhase.Finished) {
        state.rematchRequest = this.#rematchRequest;
      }

      return state;
    }
    return null;
  }

  hasPlayer(playerId: string): boolean {
    return !!this.currentGame?.hasPlayer(playerId);
  }
  getPlayer(playerId: string): IPlayer | undefined {
    return this.currentGame?.getPlayer(playerId);
  }
  getPlayers(): IPlayer[] {
    return this.currentGame?.getPlayers() ?? [];
  }
  getOpponent(ofPlayerId: string): IPlayer | undefined {
    return this.currentGame?.getOpponent(ofPlayerId);
  }

  /**
   * Summary of the battle that just ended, `undefined` while the room is not
   * in `Finished`. The index is the position of that battle in the room's
   * battle list, so a rematch yields the next index (statistics stay unique).
   */
  getFinishedBattleSummary():
    | {
        battleIndex: number;
        finishedAt: string;
        winnerId: string;
        loserId?: string;
        byForfeit: boolean;
      }
    | undefined {
    if (this.getPhase() !== EGamePhase.Finished) return undefined;

    const summary = this.currentGame?.getFinishSummary();
    if (!summary) return undefined;

    return { ...summary, battleIndex: this.battles.length };
  }

  placeShips(
    playerId: string,
    ships: (TShip & { type: "pending"; id: TCellStatusShipId })[],
  ) {
    return !!this.currentGame?.placeShips(playerId, ships);
  }

  attack(attackingPlayerId: string, target: TCoordinate) {
    return this.currentGame?.attack(attackingPlayerId, target);
  }

  forfeit(forfeitingPlayerId: string): boolean {
    return !!this.currentGame?.forfeit(forfeitingPlayerId);
  }

  identifyShip(playerId: string, cell: TCellStatus): TShip | undefined {
    if (this.currentGame) {
      return this.currentGame.identifyShip(playerId, cell);
    }
    return undefined;
  }

  /**
   * Enforces the deadline inside the state transition itself. A pending request
   * can outlive `expiresAt` when the event loop is busy and the timeout callback
   * has not run yet; accepting, rejecting or cancelling it after the deadline
   * must behave exactly like an automatic timeout.
   */
  #expireOverdueRematch(): boolean {
    if (this.#rematchRequest?.status !== "pending") return false;
    if (!this.#rematchRequest.expiresAt) return false;

    const expiresAt = Date.parse(this.#rematchRequest.expiresAt);
    if (Number.isNaN(expiresAt) || expiresAt > Date.now()) return false;

    this.#rematchRequest.status = "cancelled";
    this.#rematchRequest.cancelledReason = "timeout";
    return true;
  }

  requestRematch(requestorId: string) {
    if (
      this.currentGame &&
      this.currentGame.getPhase() === EGamePhase.Finished
    ) {
      if (this.currentGame.hasPlayer(requestorId)) {
        this.#expireOverdueRematch();

        if (this.#rematchRequest?.status === "pending") {
          return -3;
        }

        if (
          this.#rematchRequest?.status === "rejected" ||
          this.#rematchRequest?.status === "cancelled"
        ) {
          return -4;
        }
        const requestor = this.currentGame.getPlayer(requestorId);
        if (!requestor) {
          return -2;
        }

        this.#rematchRequest = {
          requestId: createId(),
          requestorId,
          status: "pending",
          name: requestor.name,
          seed: requestor.seed,
          expiresAt: new Date(
            Date.now() + REMATCH_REQUEST_TIMEOUT_MS,
          ).toISOString(),
        };
        return 1;
      }
      return -2;
    }
    return -1;
  }

  rejectRematch(winnerId: string) {
    if (
      this.currentGame &&
      this.currentGame.getPhase() === EGamePhase.Finished
    ) {
      if (this.currentGame.hasPlayer(winnerId)) {
        if (this.#expireOverdueRematch()) return -5;

        if (
          !this.#rematchRequest ||
          this.#rematchRequest.status !== "pending"
        ) {
          return -3;
        }
        if (this.#rematchRequest.requestorId === winnerId) {
          return -4;
        }

        this.#rematchRequest.status = "rejected";

        return 1;
      }
      return -2;
    }
    return -1;
  }

  cancelRematch(requestorId: string) {
    if (
      this.currentGame &&
      this.currentGame.getPhase() === EGamePhase.Finished
    ) {
      if (this.currentGame.hasPlayer(requestorId)) {
        if (this.#expireOverdueRematch()) return -5;

        if (
          !this.#rematchRequest ||
          this.#rematchRequest.status !== "pending"
        ) {
          return -3;
        }
        if (this.#rematchRequest.requestorId !== requestorId) {
          return -4;
        }

        this.#rematchRequest.status = "cancelled";
        this.#rematchRequest.cancelledReason = "cancelled";
        return 1;
      }
      return -2;
    }
    return -1;
  }

  expireRematch() {
    if (
      this.currentGame &&
      this.currentGame.getPhase() === EGamePhase.Finished &&
      this.#rematchRequest?.status === "pending"
    ) {
      this.#rematchRequest.status = "cancelled";
      this.#rematchRequest.cancelledReason = "timeout";
      return 1;
    }
    return -3;
  }
  acceptRematch(winnerId: string) {
    if (
      this.currentGame &&
      this.currentGame.getPhase() === EGamePhase.Finished
    ) {
      const winner = this.getPlayer(winnerId);

      if (winner) {
        if (this.#expireOverdueRematch()) return -5;

        if (
          !this.#rematchRequest ||
          this.#rematchRequest.status !== "pending"
        ) {
          return -3;
        }
        if (this.#rematchRequest.requestorId === winnerId) {
          return -4;
        }

        const requestor = this.currentGame.getPlayer(
          this.#rematchRequest.requestorId,
        );
        if (!requestor) {
          return -2;
        }

        this.#rematchRequest.status = "accepted";

        this.currentGame.setRematchRequest(this.#rematchRequest);

        this.battles.push(this.currentGame);

        this.currentGame = new BattleShips(10, AVAILABLE_SHIPS);

        this.addPlayer(winner);
        this.addPlayer(requestor);

        this.#rematchRequest = undefined;

        return 1;
      }
      return -2;
    }
    return -1;
  }

  /**
   * Drops any rematch negotiation, regardless of its status.
   *
   * Used when a finished room comes back from a snapshot: the pending deadline
   * belongs to a process that no longer exists and a restored `accepted` state
   * would start a battle whose players are not connected yet. After the reset
   * either player can simply request a rematch again.
   *
   * @returns `true` when there was something to clear.
   */
  resetRematchState(): boolean {
    if (!this.#rematchRequest) return false;

    this.#rematchRequest = undefined;
    this.currentGame?.setRematchRequest(undefined);

    return true;
  }

  get battlesPlayed() {
    return this.battles.length;
  }
  get playersCount() {
    return this.currentGame?.getPlayersCount() ?? 0;
  }
  get id() {
    return this.#id;
  }
  get name() {
    return this.#name;
  }

  // ISerializable
  private deserialize(data: string): void {
    const parsed = JSON.parse(data, (key, value) => {
      if (key === "currentGame" && value) {
        return BattleShips.deserialize(value);
      }
      if (key === "battles" && value) {
        return value.map((battle: string) => BattleShips.deserialize(battle));
      }
      return value;
    }) as {
      version?: number;
      id: string;
      name: string;
      currentGame?: BattleShips;
      battles: BattleShips[];
      rematchRequest?: TRematchRequest;
    };
    switch (parsed.version) {
      case 1:
        this.#id = parsed.id;
        this.#name = parsed.name;
        this.currentGame = parsed.currentGame;
        this.battles = parsed.battles;
        this.#rematchRequest = parsed.rematchRequest;
        break;

      default:
        throw new Error("Unsupported serialized source version.");
    }
  }
  serialize(): string {
    return JSON.stringify({
      version: this.version,
      id: this.#id,
      name: this.#name,
      currentGame: this.currentGame?.serialize(),
      battles: this.battles.map((battle) => battle.serialize()),
      rematchRequest: this.#rematchRequest,
    });
  }
  static deserialize(data: string): WarRoom {
    return new WarRoom(data, deserializeToken);
  }
}
