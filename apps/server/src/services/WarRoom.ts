import { AVAILABLE_SHIPS, BattleShipsBoard } from "@repo/game-logic";
import { BattleShips } from "@repo/game-logic/src/game/BattleShips";
import {
  EGamePhase,
  IPlayer,
  ISerializable,
  TGameState,
  TGameTimeStamps,
  TStringifiedEnum,
} from "@repo/types";

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
      this.currentGame.addPlayer(player);
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

  activatePlayer(userId: string): boolean {
    if (this.currentGame) {
      return this.currentGame.activatePlayer(userId);
    }
    return false;
  }

  getTimeStamps(): TGameTimeStamps {
    return this.currentGame?.getTimeStamps() ?? EMPTY_TIMESTAMP;
  }

  getPhase(): TStringifiedEnum<EGamePhase> | undefined {
    return this.currentGame?.getPhase();
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
      if(state.phase === EGamePhase.Finished) {
        state.rematchRequest = /* get rematch request */ undefined;
      }

      return state;
    }
    return null;
  }

  forfeit(forfeitingPlayerId: string) {}

  get battlesPlayed() {
    return this.battles.length;
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
    };
    switch (parsed.version) {
      case 1:
        this.#id = parsed.id;
        this.#name = parsed.name;
        this.currentGame = parsed.currentGame;
        this.battles = parsed.battles;
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
    });
  }
  static deserialize(data: string): WarRoom {
    return new WarRoom(data, deserializeToken);
  }
}
