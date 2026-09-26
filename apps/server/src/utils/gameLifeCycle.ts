import { EGamePhase, IPlayer, TRoomState, TShip } from "@repo/types";
import RoomServiceSingleton from "../services/room.service";
import ClientSessionServiceSingleton from "../services/client-session.service";
import { getOtherPlayer } from "./getOtherPlayer";
import { AVAILABLE_SHIPS, createEmptyBoard } from "@repo/game-logic";
import { getShips } from "./getShips";
import { warRoomNames } from "../services/WarRoomName.service";
import { createNewRoom } from "./createNewRoom";

export function createWarRoom(
  roomIdentifier: { name: string; id: string },
  ownerId: string,
): TRoomState | undefined {
  const roomService = RoomServiceSingleton.getInstance();

  // required user exists
  const sessions = ClientSessionServiceSingleton.getInstance();

  const clientSession = sessions.readSession(ownerId);
  if (
    !clientSession ||
    (clientSession.gameId && roomService.isRoomActive(clientSession.gameId))
  ) {
    // user does not exist, or is part of another active game
    return;
  }

  if (roomService.hasRoom(roomIdentifier.id)) {
    return;
  }
  const room = createNewRoom(
    { ...roomIdentifier },
    {
      id: ownerId,
      active: true,
      ready: false,
      owner: true,
      name: clientSession.name,
      seed: clientSession.seed,
    },
  );

  warRoomNames.claimRoom(roomIdentifier.name);

  clientSession.gameId = roomIdentifier.id;
  sessions.updateSession(ownerId, clientSession);

  // Save the room
  RoomServiceSingleton.getInstance().saveRoom(room);

  // Return the updated room
  return room;
}

/**
 * Transition room to phase `placement`, requires opponent it to join.
 * Returns modified room state, or `undefined` when it failed to transition.
 *
 * @param roomId room identifier to transition
 * @param opponentId client id of the opponent
 * @returns
 */
export function transitionToPlacement(
  roomId: string,
  opponentId: string,
): TRoomState | undefined {
  // Find the room
  const roomService = RoomServiceSingleton.getInstance();
  const room = roomService.getRoom(roomId);
  // Confirm it is waiting
  if (!room || room.phase !== EGamePhase.Waiting) {
    return;
  }

  if (countPlayers(room.players) === 0 || countPlayers(room.players) > 1) {
    // invalid number of players or not enough space for new player
    return;
  }

  if (room.players[opponentId]) {
    return;
  }

  // required user exists
  const sessions = ClientSessionServiceSingleton.getInstance();

  const clientSession = sessions.readSession(opponentId);
  if (!clientSession) {
    return;
  }

  if (
    clientSession.gameId &&
    roomService.hasRoom(clientSession.gameId) &&
    roomService.isRoomActive(clientSession.gameId)
  ) {
    // user is in another active game
    return;
  }

  // waiting -> placement
  room.phase = EGamePhase.Placement;

  // add opponent
  room.boards[opponentId] = createEmptyBoard();
  const opponent: IPlayer = {
    id: opponentId,
    active: true,
    ready: false,

    name: clientSession.name,
    seed: clientSession.seed,
  };
  room.players[opponentId] = opponent;

  room.ships = getShips(Object.keys(room.players), AVAILABLE_SHIPS);

  // set session's game id
  clientSession.gameId = room.id;
  sessions.updateSession(opponentId, clientSession);

  // Save the room
  RoomServiceSingleton.getInstance().saveRoom(room);

  // Return the updated room
  return room;
}

/**
 * Transition room to phase `waiting` (from `placement`), requires leaving player id.
 * Returns modified room state, or `undefined` when it failed to transition.
 * @param roomId room identifier to transition
 * @param leavingPlayerId client id of the leaving player
 * @returns
 */
export function transitionToWaiting(
  roomId: string,
  leavingPlayerId: string,
): TRoomState | undefined {
  // Find the room
  const room = RoomServiceSingleton.getInstance().getRoom(roomId);
  // Confirm it is placement
  if (!room || room.phase !== EGamePhase.Placement) {
    return;
  }

  if (countPlayers(room.players) < 1) {
    // invalid number of players
    return;
  }

  if (!containsPlayer(leavingPlayerId, room.players)) {
    return;
  }

  // required user exists
  const sessions = ClientSessionServiceSingleton.getInstance();

  const clientSession = sessions.readSession(leavingPlayerId);
  if (!clientSession || clientSession.gameId !== room.id) {
    return;
  }

  // Move the room to waiting
  // placement -> waiting
  room.phase = EGamePhase.Waiting;

  // Promote the remaining player
  const other = getOtherPlayer(leavingPlayerId, room.players);
  if (!other) {
    return;
  }
  // if user that left is the "owner" change the turn
  room.turn = other.id;
  other.owner = true;

  // Remove the player
  delete room.boards[leavingPlayerId];
  delete room.players[leavingPlayerId];
  room.ships = {};

  // Clear the departing session’s gameId
  clientSession.gameId = undefined;
  sessions.updateSession(leavingPlayerId, clientSession);

  // Save the room
  RoomServiceSingleton.getInstance().saveRoom(room);

  // Return the updated room
  return room;
}

/**
 * Transition room to phase `playing` (from `placement`),
 * requires that both players are assigned, and opponent to be ready
 * and last player to be not yet ready.
 * Returns modified room state, or `undefined` when it failed to transition.
 * @param roomId room identifier to transition
 * @param playerId last player that placed ships
 * @param placedShips valid ships
 * @returns
 */
export function transitionToPlaying(
  roomId: string,
  playerId: string,
  placedShips: TShip[],
) {
  // Find the room
  const room = RoomServiceSingleton.getInstance().getRoom(roomId);
  // Confirm it is placement
  if (!room || room.phase !== EGamePhase.Placement) {
    return;
  }

  if (countPlayers(room.players) !== 2) {
    // invalid number of players
    return;
  }

  // required user exists
  const sessions = ClientSessionServiceSingleton.getInstance();

  const clientSession = sessions.readSession(playerId);
  if (!clientSession || clientSession.gameId !== room.id) {
    return;
  }

  // Get opponent
  const opponent = getOtherPlayer(playerId, room.players);
  if (!opponent || !opponent.active || !opponent.ready) {
    return;
  }

  const lastPlayer = room.players[playerId];
  if (!lastPlayer || lastPlayer.ready) {
    // still invalid
    return;
  }

  // Change ready state and store ships
  lastPlayer.ready = true;
  room.ships[playerId] = placedShips;

  // Move the room to playing
  // placement -> playing
  room.phase = EGamePhase.Playing;
  room.game_started = new Date().toISOString();

  // Save the room
  RoomServiceSingleton.getInstance().saveRoom(room);

  // Return the updated room
  return room;
}

/**
 * Transition room to phase `finished` (from `playing`), requires the winner id
 * @param roomId room identifier to transition
 * @param playerId winning player id, or loser (forfeiting) when `forfeit` flag is `true`.
 * @param forfeit when `true` the `playerId` is the loser.
 */
export function transitionToFinished(
  roomId: string,
  playerId: string,
  forfeit?: boolean,
) {
  // Find the room
  const room = RoomServiceSingleton.getInstance().getRoom(roomId);
  // Confirm it is placement
  if (!room || room.phase !== EGamePhase.Playing) {
    return;
  }

  if (countPlayers(room.players) !== 2) {
    // invalid number of players
    return;
  }

  if (!containsPlayer(playerId, room.players)) {
    return;
  }

  // required user exists
  const sessions = ClientSessionServiceSingleton.getInstance();

  const clientSessionWinner = sessions.readSession(playerId);
  if (!clientSessionWinner || clientSessionWinner.gameId !== room.id) {
    return;
  }

  // Get opponent
  const opponent = getOtherPlayer(playerId, room.players);
  if (!opponent || !opponent.active) {
    return;
  }

  // playing -> finished
  room.phase = EGamePhase.Finished;

  // last history entry
  room.history.push({
    finish: true,
    whoWon: forfeit ? opponent.id : playerId,
  });

  // results
  room.result[playerId] = forfeit ? "lost" : "win";
  room.result[opponent.id] = forfeit ? "win" : "lost";

  // timestamp
  room.game_finished = new Date().toISOString();

  if (forfeit && room.players[playerId]) {
    room.players[playerId].active = false;
  }

  // clear session for all players
  Object.values(room.players).forEach((player) => {
    sessions.clearSessionGame(player.id);
  });

  // Save the room
  RoomServiceSingleton.getInstance().saveRoom(room);

  warRoomNames.releaseRoom(room.name);

  // Return the updated room
  return room;
}

function countPlayers(players: Record<string, IPlayer>): number {
  try {
    return Object.keys(players).length;
  } catch {
    return 0;
  }
}

function containsPlayer(
  playerId: string,
  players: Record<string, IPlayer>,
): boolean {
  try {
    return (
      Object.values(players).findIndex((needle) => needle.id === playerId) !==
      -1
    );
  } catch {
    return false;
  }
}
