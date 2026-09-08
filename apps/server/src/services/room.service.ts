import { EGamePhase, TRoomState } from "@repo/types";

export type TRoomsMap = Map<string, TRoomState>;

const rooms: TRoomsMap = new Map<string, TRoomState>();

export const RoomService = {
  getRooms: () => rooms,
  getRoom: (id: string) => rooms.get(id),
  saveRoom: (room: TRoomState) => rooms.set(room.id, room),
  deleteRoom: (id: string) => rooms.delete(id),

  findRoomBySocketId: (socketId: string) => {
    return Array.from(rooms.values()).find((r) => r.players[socketId]);
  },

  getOpenGames: () => {
    return Array.from(rooms.values())
      .filter((room) => room.phase === EGamePhase.Waiting)
      .map(({ id, name, game_finished, game_started, game_created }) => ({
        id,
        name,
        game_finished,
        game_started,
        game_created,
      }));
  },
};
