import {
  ECellStatus,
  EGamePhase,
  IPlayer,
  TCoordinate,
  THistoryEntry,
  TRoomState,
  TShip,
} from "@repo/types";
import RoomServiceSingleton from "../services/room.service";
import ClientSessionServiceSingleton from "../services/client-session.service";
import { getOtherPlayer } from "./getOtherPlayer";
import {
  AVAILABLE_SHIPS,
  createEmptyBoard,
  getCell,
  isSunk,
  placeShip,
  resolveAttack,
  setCell,
} from "@repo/game-logic";
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

export function destroyWarRoom(leavingPlayerId: string) {
  const roomService = RoomServiceSingleton.getInstance();
  const session = ClientSessionServiceSingleton.getInstance();

  const clientSession = session.readSession(leavingPlayerId);
  if (!clientSession || !clientSession.gameId) {
    return;
  }

  const room = roomService.getRoom(clientSession.gameId);
  if (!room) {
    return;
  }

  roomService.deleteRoom(room.id);

  warRoomNames.releaseRoom(room.name);

  clientSession.gameId = undefined;
  session.updateSession(leavingPlayerId, clientSession);
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

  // assign ships for both players
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
 * @returns Updated and saved room or undefined if it failed
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
 * During placement phase, apply the ships and mark the player as ready.
 * @param roomId room identifier to update
 * @param playerId first player to be ready
 * @param placedShips verified ships placement
 * @returns Updated and saved room or undefined if it failed
 */
export function applyShipsAndMarkReady(
  roomId: string,
  playerId: string,
  placedShips: (TShip & { type: "placed" })[],
): TRoomState | undefined {
  // Find the room
  const roomService = RoomServiceSingleton.getInstance();
  const room = roomService.getRoom(roomId);
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

  const player = room.players[playerId];
  if (!player || player.ready) {
    // still invalid
    return;
  }

  // Change ready state and store ships
  player.ready = true;
  room.ships[playerId] = placedShips;
  placedShips.forEach((ship: TShip & { type: "placed" }) => {
    if (room.boards[playerId]) {
      placeShip(room.boards[playerId], ship.coords, ship, ship.orientation);
    }
  });

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
  placedShips: (TShip & { type: "placed" })[],
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
  // update board
  placedShips.forEach((ship: TShip & { type: "placed" }) => {
    if (room.boards[playerId]) {
      placeShip(room.boards[playerId], ship.coords, ship, ship.orientation);
    }
  });

  // Move the room to playing
  // placement -> playing
  room.phase = EGamePhase.Playing;
  room.game_started = new Date().toISOString();

  // Save the room
  RoomServiceSingleton.getInstance().saveRoom(room);

  // Return the updated room
  return room;
}

export function updateRoomWithNewTurnData(
  roomId: string,
  playerId: string,
  coord?: TCoordinate,
) {
  console.log("[updateRoomWithNewTurnData]", roomId, playerId, coord);
  // Find the room
  const room = RoomServiceSingleton.getInstance().getRoom(roomId);
  // Confirm it is playing phase
  if (!room || room.phase !== EGamePhase.Playing) {
    return;
  }
  if (!coord) {
    return;
  }

  // apply game turn data

  // required user exists
  const sessions = ClientSessionServiceSingleton.getInstance();

  const clientSession = sessions.readSession(playerId);
  if (!clientSession || clientSession.gameId !== room.id) {
    return;
  }

  const opponent = getOtherPlayer(playerId, room.players);
  const opponentSession = sessions.readSession(opponent?.id ?? "");
  if (!opponent || !opponentSession || opponentSession.gameId !== room.id) {
    return;
  }

  const targetBoard = room.boards[opponent.id];
  if (!targetBoard) {
    return;
  }
  console.log("[updateRoomWithNewTurnData]", "room.boards", room.boards);
  const cell = getCell(targetBoard, coord.x, coord.y);
  console.log("[updateRoomWithNewTurnData]", "cell", cell, coord);
  if (typeof cell === "number" && cell < 0) {
    console.error(
      "Failed to retrieve board cell",
      `Error code: ${cell}`,
      coord,
      targetBoard,
    );
    return;
  }

  if (
    cell === ECellStatus.Hit ||
    cell === ECellStatus.Destroyed ||
    cell === ECellStatus.Miss
  ) {
    // already attacked, ignore
    return;
  }

  const attackResult = resolveAttack(targetBoard, coord);
  console.log("[updateRoomWithNewTurnData]", "attackResult", attackResult);
  const result = setCell(targetBoard, coord.x, coord.y, attackResult);
  if (result < 0) {
    console.error("Failed to update board cell", result, coord, targetBoard);
    return;
  }

  // Update history
  if (room.history.length === 0) {
    room.history.push({
      init: true,
    });
  }

  const historyEntry: THistoryEntry = {
    coords: coord,
    isSunk: false,
    result: attackResult,
    turn: playerId,
  };

  // fire at ship, check if it is sunk
  if (attackResult === ECellStatus.Hit) {
    const enemyFleet = room.ships[opponent.id];
    if (enemyFleet && typeof cell === "number" && cell >= 0) {
      const index = enemyFleet.findIndex(({ id }) => id === cell);
      if (index >= 0) {
        const enemyShip = enemyFleet[index];
        if (enemyShip && enemyShip.type === "placed" && !isSunk(enemyShip)) {
          enemyShip.hits.push(coord);
          if (enemyShip.hits.length === enemyShip.size) {
            historyEntry.isSunk = true;
          }
        }
      }
    }
  }

  room.history.push(historyEntry);

  room.turn = opponent.id;

  // Save the room
  RoomServiceSingleton.getInstance().saveRoom(room);

  // Return the updated room
  return room;
}

export function requestRematch(roomId: string, playerId: string) {
  const room = RoomServiceSingleton.getInstance().getRoom(roomId);
  if (!room || room.phase !== EGamePhase.Finished) {
    return;
  }

  if (!containsPlayer(playerId, room.players)) {
    return;
  }

  if (room.rematchRequest?.status === "pending") {
    return;
  }

  if (room.rematchRequest?.status === "rejected") {
    return;
  }

  room.rematchRequest = {
    requestorId: playerId,
    status: "pending",
  };

  RoomServiceSingleton.getInstance().saveRoom(room);
  return room;
}

export function rejectRematch(roomId: string, winnerId: string) {
  const room = RoomServiceSingleton.getInstance().getRoom(roomId);
  if (!room || room.phase !== EGamePhase.Finished) {
    return;
  }

  if (!containsPlayer(winnerId, room.players)) {
    return;
  }

  if (!room.rematchRequest || room.rematchRequest.status !== "pending") {
    return;
  }

  if (room.rematchRequest.requestorId === winnerId) {
    return;
  }

  room.rematchRequest = {
    requestorId: room.rematchRequest.requestorId,
    status: "rejected",
  };

  RoomServiceSingleton.getInstance().saveRoom(room);
  return room;
}

export function acceptRematch(roomId: string, winnerId: string) {
  const room = RoomServiceSingleton.getInstance().getRoom(roomId);
  if (!room || room.phase !== EGamePhase.Finished) {
    return;
  }

  if (!containsPlayer(winnerId, room.players)) {
    return;
  }

  const requestorId = room.rematchRequest?.requestorId;
  if (!requestorId || requestorId === winnerId) {
    return;
  }

  if (room.rematchRequest?.status !== "pending") {
    return;
  }

  const requester = room.players[requestorId];
  if (!requester) {
    return;
  }

  room.phase = EGamePhase.Placement;
  room.game_started = null;
  room.game_finished = null;
  room.turn = winnerId;
  room.history = [];
  room.result = {};
  room.rematchRequest = {
    requestorId,
    status: "accepted",
  };

  Object.values(room.players).forEach((player) => {
    player.ready = false;
    player.active = true;
    player.owner = player.id === winnerId;
  });

  room.boards = Object.fromEntries(
    Object.keys(room.players).map((playerId) => [playerId, createEmptyBoard()]),
  );
  room.ships = getShips(Object.keys(room.players), AVAILABLE_SHIPS);

  RoomServiceSingleton.getInstance().saveRoom(room);
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

  room.turn = playerId;

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
