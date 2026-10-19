import { afterEach, describe, expect, it, vi } from "vitest";
import RoomServiceSingleton from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import {
  createFinishedGameRoom,
  createIo,
  createSocket,
} from "./__tests/utils";
import {
  factoryAcceptRematchHandler,
  factoryRejectRematchHandler,
  factoryRequestRematchHandler,
} from "./rematch";
import { toGameState } from "../../../utils/toGameState";
import { TRoomState } from "@repo/types";
import { requestRematch } from "../../../utils/gameLifeCycle";

const roomService = RoomServiceSingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

describe("rematch handler", () => {
  afterEach(() => {
    roomService.listRooms().forEach((room) => roomService.deleteRoom(room.id));
    ["owner", "opponent"].forEach((id) => sessionService.deleteSession(id));
  });

  it("should handle rematch request correctly", () => {
    const roomId = "rematch-requested-room";
    // owner is the winner, it should receive a rematch request from the opponent
    const room = createFinishedGameRoom(roomId, "owner");
    roomService.saveRoom(room);
    sessionService.createSession("owner", "owner-socket");
    sessionService.createSession("opponent", "opponent-socket");

    const mockedId = createIo();
    const mockedSocket = createSocket("opponent");
    const handler = factoryRequestRematchHandler(mockedId, mockedSocket);

    handler();

    // room should now have the opponent's rematch request recorded
    const updatedRoom = roomService.getRoom(roomId);
    expect(updatedRoom).toBeDefined();
    expect(updatedRoom?.phase).toBe("finished");
    expect(updatedRoom?.rematchRequest?.requestorId).toContain("opponent");
    expect(updatedRoom?.rematchRequest?.status).toContain("pending");

    // requestor should have received room state update with rematch request status
    const sentGameState = toGameState("opponent", updatedRoom as TRoomState);

    expect(sentGameState).toBeDefined();

    // sent game state needs to include the rematch request status
    expect(sentGameState!.rematchRequest).toEqual({
      requestorId: "opponent",
      status: "pending",
      name: updatedRoom?.players["opponent"]?.name ?? "",
      seed: updatedRoom?.players["opponent"]?.seed ?? 0,
    });

    expect(mockedSocket.emit).toHaveBeenCalledWith(
      "game_updated",
      sentGameState,
    );

    // other player should have received `rematch_requeted` event
    expect(mockedId._toSpy).toHaveBeenCalledWith("rematch_requested", {
      requestorId: "opponent",
      status: "pending",
      name: updatedRoom?.players["opponent"]?.name ?? "",
      seed: updatedRoom?.players["opponent"]?.seed ?? 0,
    });
  });

  it("should handle rematch accepted request correctly", () => {
    const roomId = "rematch-accepted-room";
    // owner is the winner, it should receive a rematch request from the opponent
    const room = createFinishedGameRoom(roomId, "owner");
    roomService.saveRoom(room);
    sessionService.createSession("owner", "owner-socket");
    sessionService.createSession("opponent", "opponent-socket");
    expect(room.phase).toBe("finished");
    const roomWithRematchRequest = requestRematch(roomId, "opponent");
    expect(roomWithRematchRequest).toBeDefined();
    expect(roomWithRematchRequest).not.toBeTypeOf("number");
    const roomWithRematch = roomWithRematchRequest as TRoomState;

    expect(roomWithRematch?.rematchRequest?.requestorId).toBe("opponent");
    expect(roomWithRematch?.rematchRequest?.status).toBe("pending");
    roomService.saveRoom(roomWithRematch!);

    const mockedId = createIo();
    const mockedSocket = createSocket("owner");
    // winner (owner) accepts the rematch request from the opponent
    const handler = factoryAcceptRematchHandler(mockedId, mockedSocket);

    handler();

    // players sessions should have gameId set
    const ownerSession = sessionService.readSession("owner");
    const opponentSession = sessionService.readSession("opponent");
    expect(ownerSession?.gameId).toBe(roomId);
    expect(opponentSession?.gameId).toBe(roomId);

    // room should now be in placement phase
    const updatedRoom = roomService.getRoom(roomId);
    expect(updatedRoom).toBeDefined();
    expect(updatedRoom?.phase).toBe("placement");

    // room now has removed rematchRequest
    expect(updatedRoom?.rematchRequest).toBeUndefined();

    // requestor should have received room state update with rematch request status
    const loserGameState = toGameState("opponent", updatedRoom as TRoomState);
    const winnerGameState = toGameState("owner", updatedRoom as TRoomState);

    expect(loserGameState).toBeDefined();
    expect(winnerGameState).toBeDefined();

    // rematch_accepted event
    expect(mockedId._toSpy).toHaveBeenCalledWith("rematch_accepted", {
      roomId,
      status: "accepted",
    });

    // players should be notified
    expect(mockedId._toSpy).toHaveBeenCalledWith(
      "game_updated",
      winnerGameState,
    );
    expect(mockedId._toSpy).toHaveBeenCalledWith(
      "game_updated",
      loserGameState,
    );
  });

  it("should handle rematch rejected request correctly", () => {
    const roomId = "rematch-rejected-room";
    // owner is the winner, it should receive a rematch request from the opponent
    const room = createFinishedGameRoom(roomId, "owner");
    roomService.saveRoom(room);
    sessionService.createSession("owner", "owner-socket");
    sessionService.createSession("opponent", "opponent-socket");

    const roomWithRematchRequest = requestRematch(roomId, "opponent");
    expect(roomWithRematchRequest).toBeDefined();

    expect(roomWithRematchRequest).not.toBeTypeOf("number");
    const roomWithRematch = roomWithRematchRequest as TRoomState;

    expect(roomWithRematch?.rematchRequest?.requestorId).toBe(
      "opponent",
    );
    expect(roomWithRematch?.rematchRequest?.status).toBe("pending");
    roomService.saveRoom(roomWithRematch!);

    const mockedId = createIo();
    const mockedSocket = createSocket("owner");
    // winner (owner) accepts the rematch request from the opponent
    const handler = factoryRejectRematchHandler(mockedId, mockedSocket);

    handler();

    // room should now be in placement phase
    const updatedRoom = roomService.getRoom(roomId);

    // rematch request is accepted
    expect(updatedRoom?.rematchRequest?.status).toBe("rejected");

    // requestor should have received room state update with rematch request status
    const loserGameState = toGameState("opponent", updatedRoom as TRoomState);
    const winnerGameState = toGameState("owner", updatedRoom as TRoomState);

    expect(loserGameState).toBeDefined();
    expect(winnerGameState).toBeDefined();
    // sent game state needs to include the rematch request status
    expect(winnerGameState!.rematchRequest).toEqual({
      requestorId: "opponent",
      status: "rejected",
      name: updatedRoom?.players["opponent"]?.name ?? "",
      seed: updatedRoom?.players["opponent"]?.seed ?? 0,
    });
    expect(loserGameState!.rematchRequest).toEqual({
      requestorId: "opponent",
      status: "rejected",
      name: updatedRoom?.players["opponent"]?.name ?? "",
      seed: updatedRoom?.players["opponent"]?.seed ?? 0,
    });

    // rematch_accepted event
    expect(mockedId._toSpy).toHaveBeenCalledWith("rematch_rejected", {
      roomId,
      status: "rejected",
      requestorId: "opponent",
    });

    // player should be notified
    expect(mockedId._toSpy).toHaveBeenCalledWith(
      "game_updated",
      winnerGameState,
    );
    expect(mockedId._toSpy).toHaveBeenCalledWith(
      "game_updated",
      loserGameState,
    );
  });
});
