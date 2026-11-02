export interface IActiveUsersService {
  setUser: (userId: string) => void;
  removeUser: (userId: string) => boolean;
  countUsers: () => number;
  forEach: (callback: (userId: string) => void) => void;
}

export class ActiveUsersService implements IActiveUsersService {
  public setUser(userId: string) {
    this.users.add(userId);
  }

  public countUsers() {
    return this.users.size;
  }
  public removeUser(userId: string) {
    return this.users.delete(userId);
  }

  public forEach(callback: (userId: string) => void) {
    this.users.forEach(callback);
  }

  private users = new Set<string>();

  private log(...msg: string[]) {
    console.log("[ActiveUsersService]", ...msg);
  }
}
