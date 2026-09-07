import { generateWarRoomName, MAX_COMBINATIONS } from "./generateWarRoomName";

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
}
