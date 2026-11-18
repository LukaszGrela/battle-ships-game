```
Front: "BOT" na liście ── emit bot_opponent ──► game.handlers
   │ walidacja (owner, Waiting)                      │
   └─ "Create with Bot" ──► create_room handler ─────┤
                                                     ▼
                            BotRunner.spawnBot(roomId)
                              • IPlayer {id: "bot-…", botLevel: 'easy', piracki nick}
                              • room.addPlayer(player)
                              • new ProbabilityBrain({seed, blunderChance})
                              • bot.schedule()
                                                     │
                        emitRoomStateToPlayers ◄─────┘
                              • owner widzi enemy z botLevel → awatara z puli botów
                              • onRoomStateChanged(roomId)  ← CHOKE POINT
                                                     │
                              BotPlayer: Placement→placeFleet / Playing→shoot
                                │ room.placeShips / room.attack (te same API co człowiek)
                                ▼
                        emitRoomStateToPlayers → pętla się podtrzymuje
```
