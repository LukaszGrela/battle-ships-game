export type Coordinate = { x: number; y: number };
export type CellStatus = 'empty' | 'ship' | 'hit' | 'miss';

export interface GameState {
  id: string;
  phase: 'waiting' | 'placement' | 'playing' | 'finished';
  turn: string; // socketId
  boards: Record<string, CellStatus[][]>; // socketId -> 10x10 grid
}

export interface ClientToServerEvents {
  join_game: (roomId: string) => void;
  place_ships: (ships: Coordinate[]) => void;
  attack_coordinate: (coord: Coordinate) => void;
}

export interface ServerToClientEvents {
  game_updated: (state: GameState) => void;
  error: (msg: string) => void;
}
