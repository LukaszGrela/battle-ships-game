# Battleships - frontend

To ensure a smooth user experience, the Battleship game flow is designed to be synchronous, where the server acts as the "referee" at every stage.

Here is the step-by-step flow from the user's perspective:

### 1. Initialization
*   **Opening:** The user opens `apps/web`. 
*   **Connection:** The client automatically establishes a Socket.io connection and creates a local instance of the `IGameState` (initially `null` or a loading screen).
*   **Lobby:** The user enters a `Room ID` or clicks "Join Random Game." The client emits `join_game`.

### 2. The Setup Phase (`EGamePhase.Placement`)
*   **Board Setup:** Once two players are in the room, both see their empty 10x10 grids.
*   **Placing Ships:** 
    *   The user clicks cells on their board to place ships.
    *   The client holds this state locally until the user clicks "Ready."
    *   The client emits `place_ships(TCoordinate[])`.
*   **Validation:** The server receives the ship coordinates, validates that they don't overlap or go out of bounds, and updates the `IGameState`.
*   **Status Update:** Both clients receive `game_updated` with the phase set to `EGamePhase.Playing`.

### 3. The Combat Phase (`EGamePhase.Playing`)
*   **Turn Indicator:** The UI displays "Your Turn" or "Waiting for Opponent" based on whether `room.turn === socket.id`.
*   **Firing:**
    *   The active player clicks a coordinate on the **"Fog of War"** (opponent's) grid.
    *   The client emits `attack_coordinate(TCoordinate)`.
    *   The client temporarily disables clicks to prevent double-firing while waiting for server confirmation.
*   **Result Processing:**
    *   The server calculates if it's a hit or miss.
    *   The server flips the `turn` variable to the other player.
    *   The server broadcasts the updated `IGameState` to both clients.
*   **UI Feedback:** 
    *   The boards re-render. 
    *   The player sees the target cell update to `ECellStatus.Hit` or `ECellStatus.Miss`.

### 4. Game Over (`EGamePhase.Finished`)
*   **Detection:** After every attack, the server checks if all `Ship` cells in a board are marked `Hit`.
*   **Resolution:** 
    *   The server updates the phase to `EGamePhase.Finished`.
    *   The server broadcasts the final state, including a "Winner" declaration.
*   **Post-Game:** The UI displays a "Game Over" overlay with a "Play Again" button, which clears the local state and returns the player to the Lobby.

---

### Summary of State Transitions

| User Action | Event Emitted | Server Action |
| :--- | :--- | :--- |
| Enter Room ID | `join_game` | Assigns player to room, waits for 2nd player |
| Place Ships | `place_ships` | Saves ship positions in secret state |
| Click Opponent Grid | `attack_coordinate` | Checks coordinates, updates state, toggles turn |
| Detect All Ships Sunk | (Server-side check) | Sets state to `Finished` |

### Edge Case Handling (From the User's Perspective)
*   **The "Hanging" User:** If the opponent stops responding, the UI shows a "Waiting for opponent..." indicator. If the server detects a `disconnect`, it broadcasts a "Opponent left" message and sets the state to `Finished`, awarding the remaining player the win.
*   **Simultaneous Clicks:** Because the server is the "Source of Truth," if two players click at the exact same time, the server processes them in arrival order and ignores the second request (because the `room.turn` was already toggled by the first). The client UI simply refreshes to the latest server state, keeping the boards in sync.
