import { EGamePhase, TRoomIdentity } from "@repo/types";
import { WarRoom } from "./WarRoom";

export interface IActiveGameRegistry {
  /**
   * Add or update `WarRoom instance
   * @param id room identifier
   * @param room WarRoom instance
   */
  addRoom(id: string, room: WarRoom): void;
  /**
   * Checks if registry holds given rom
   * @param id room identifier
   */
  hasRoom(id: string): boolean;
  /**
   * Returns `WarRoom` instance stored in the registry or `undefined`
   * @param id room identifier
   */
  getRoom(id: string): WarRoom | undefined;
  /**
   * Removes `WarRoom` instance from registry and returns it or `undefined` if war room does not exists.
   * @param id room identifier
   */
  deleteRoom(id: string): WarRoom | undefined;
  /**
   * Returns number of WarRoom's with active games (Playing or Placement phase).
   */
  activeGames(): number;
  /**
   * Returns number of finished games including rematches.
   */
  playedGames(): number;

  getOpenGames(): TRoomIdentity[];
  listRooms(): TRoomIdentity[];
  findFinishedRoomForPlayer(playerId: string): TRoomIdentity | undefined;
}

/**
 * Registry of active games. Game is active when not destroyed/archived.
 */
export class ActiveGameRegistry implements IActiveGameRegistry {
  private warRooms = new Map<string, WarRoom>();

  addRoom(id: string, room: WarRoom) {
    this.warRooms.set(id, room);
  }
  hasRoom(id: string): boolean {
    return this.warRooms.has(id);
  }
  getRoom(id: string): WarRoom | undefined {
    return this.warRooms.get(id);
  }
  deleteRoom(id: string): WarRoom | undefined {
    if (this.hasRoom(id)) {
      const room = this.getRoom(id);
      this.warRooms.delete(id);
      return room;
    }
    return undefined;
  }

  activeGames(): number {
    return Array.from(this.warRooms.values()).filter(
      (needle) =>
        needle.getPhase() === EGamePhase.Placement ||
        needle.getPhase() === EGamePhase.Playing,
    ).length;
  }

  playedGames(): number {
    return Array.from(this.warRooms.values())
      .filter((needle) => needle.getPhase() !== EGamePhase.Waiting)
      .reduce((acc, room) => {
        // count finished as 1 + battles length
        if (room.getPhase() === EGamePhase.Finished) {
          return acc + 1 + room.battlesPlayed;
        }
        // count placement and playing as 0 + battles length
        return acc + room.battlesPlayed;
      }, 0);
  }

  getOpenGames(): TRoomIdentity[] {
    return this.listRooms().filter(
      (room) => room.phase === EGamePhase.Waiting && room.game_created !== null,
    );
  }

  listRooms(): TRoomIdentity[] {
    return Array.from(this.warRooms.values()).map((room): TRoomIdentity => ({
      id: room.id,
      name: room.name,
      phase: room.getPhase() ?? EGamePhase.Waiting,
      ...room.getTimeStamps(),
    }));
  }

  findFinishedRoomForPlayer(playerId: string): TRoomIdentity | undefined {
    const warRoom = Array.from(this.warRooms.values()).find((room) => {
      if (room.getPhase() !== EGamePhase.Finished) {
        return false;
      }
      return room.hasPlayer(playerId);
    });

    if (warRoom) {
      return {
        id: warRoom.id,
        name: warRoom.name,
        phase: warRoom.getPhase() ?? EGamePhase.Waiting,
        ...warRoom.getTimeStamps(),
      };
    }

    return undefined;
  }
}
