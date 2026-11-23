import {
  generateWarRoomName,
  MAX_COMBINATIONS,
} from "../utils/generateWarRoomName";

export class WarRoomNameService {
  private activeRooms = new Set<string>();
  public getAvailableName(): string | null {
    if (this.activeRooms.size >= MAX_COMBINATIONS) {
      return null;
    }
    let name: string;
    do {
      name = generateWarRoomName();
    } while (this.activeRooms.has(name));

    return name;
  }

  public isFreeToClaim(name: string): boolean {
    return !this.activeRooms.has(name);
  }

  public claimRoom(name: string): boolean {
    if (!this.isFreeToClaim(name)) return false;

    this.activeRooms.add(name);
    return true;
  }

  public releaseRoom(name: string): void {
    this.activeRooms.delete(name);
  }

  /** Names currently taken, in snapshot order. Used by the state layer. */
  public listClaimed(): string[] {
    return Array.from(this.activeRooms);
  }

  /** Restores the whole claim set (server restart). */
  public restoreClaimed(names: readonly string[]): void {
    this.activeRooms = new Set(names);
  }
}

export const warRoomNames = new WarRoomNameService();
