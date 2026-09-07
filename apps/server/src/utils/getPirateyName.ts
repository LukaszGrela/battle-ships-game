// ─── Data Pools ───────────────────────────────────────────────────────────────
const TITLES = [
  "Captain",
  "Admiral",
  "Commodore",
  "Buccaneer",
  "Corsair",
  "Privateer",
  "Quartermaster",
  "Boatswain",
  "Sailing Master",
  "First Mate",
  "Gunner",
  "Swashbuckler",
  "Sea Wolf",
  "Sea Dog",
  "Plunderer",
  "Raider",
  "Reaver",
  "Scourge",
  "Dread",
  "Iron",
  "Bloody",
  "Black",
  "Red",
  "Mad",
  "Old",
  "Scurvy",
  "One-Eyed",
  "Peg-Leg",
  "Hook-Hand",
  "Grizzled",
] as const;

const NAMES = [
  "Jack",
  "Jack",
  "Jack", // weighted — very piratey
  "Will",
  "Billy",
  "Bones",
  "Peg",
  "Rum",
  "Sparrow",
  "Morgan",
  "Drake",
  "Hawkins",
  "Silver",
  "Flint",
  "Kidd",
  "Blackbeard",
  "Barbossa",
  "Rackham",
  "Teach",
  "Bonny",
  "Read",
  "Vane",
  "Skull",
  "Cutlass",
  "Barnacle",
  "Squint",
  "Grin",
  "Scurvy",
  "Plank",
  "Gibbet",
  "Havoc",
  "Storm",
  "Tide",
  "Crow",
] as const;

const ADJECTIVES = [
  "Salty",
  "Saucy",
  "Scurvy",
  "Rotten",
  "Dread",
  "Black",
  "Red",
  "Crimson",
  "Iron",
  "Bloody",
  "Fearsome",
  "Mighty",
  "Brave",
  "Bold",
  "Crafty",
  "Wily",
  "Cunning",
  "Vicious",
  "Ruthless",
  "Merciless",
  "Storm-Battered",
  "Barnacle-Crusted",
  "Rusty",
  "Shattered",
  "Thunderous",
] as const;

const NOUNS = [
  "Squid",
  "Kraken",
  "Octopus",
  "Shark",
  "Barracuda",
  "Manta Ray",
  "Seagull",
  "Albatross",
  "Pelican",
  "Swordfish",
  "Whale",
  "Dolphin",
  "Marlin",
  "Tuna",
  "Piranha",
  "Eel",
  "Jellyfish",
  "Starfish",
  "Crab",
  "Lobster",
  "Barnacle",
  "Clam",
  "Oyster",
  "Scallop",
  "Treasure",
  "Gold",
  "Doubloon",
  "Piece of Eight",
  "Ruby",
  "Emerald",
  "Pearl",
  "Amber",
  "Coins",
  "Booty",
  "Plunder",
  "Loot",
  "Rum",
  "Grog",
  "Ale",
  "Cider",
  "Mead",
  "Skull",
  "Crossbones",
  "Cutlass",
  "Sabre",
  "Pistol",
  "Cannon",
  "Anchor",
  "Compass",
  "Map",
  "Chart",
  "Spyglass",
  "Flag",
  "Sails",
  "Mast",
  "Rudder",
  "Wheel",
  "Deck",
  "Hull",
  "Bow",
  "Storm",
  "Hurricane",
  "Typhoon",
  "Monsoon",
  "Squall",
  "Gale",
  "Wave",
  "Tide",
  "Current",
  "Reef",
  "Shallows",
  "Deep",
  "Island",
  "Atoll",
  "Cove",
  "Bay",
  "Harbour",
  "Port",
  "Dawn",
  "Dusk",
  "Twilight",
  "Midnight",
  "Sunset",
  "Moonlight",
  "Raven",
  "Crow",
  "Vulture",
  "Hawk",
  "Falcon",
] as const;

const SHIP_PARTS = [
  "Revenge",
  "Vengeance",
  "Wrath",
  "Fury",
  "Rage",
  "Doom",
  "Fortune",
  "Fate",
  "Destiny",
  "Star",
  "Comet",
  "Meteor",
  "Serpent",
  "Dragon",
  "Wyrm",
  "Hydra",
  "Chimera",
  "Basilisk",
  "Shadow",
  "Ghost",
  "Spectre",
  "Phantom",
  "Wraith",
  "Haunt",
  "Rogue",
  "Outlaw",
  "Renegade",
  "Marauder",
  "Freebooter",
  "Dawn",
  "Rising Sun",
  "Setting Sun",
  "Night",
  "Darkness",
  "Sea Flower",
  "Mermaid",
  "Siren",
  "Lorelei",
  "Pearl",
  "Diamond",
  "Sapphire",
  "Ruby",
  "Emerald",
] as const;

const INSULTS = [
  "Dog",
  "Rat",
  "Cockroach",
  "Weasel",
  "Snake",
  "Eel",
  "Barnacle",
  "Louse",
  "Flea",
  "Maggot",
  "Leech",
  "Vulture",
  "Coward",
  "Scallywag",
  "Landlubber",
  "Pollywog",
  "Crab",
  "Squid",
  "Jellyfish",
  "Sea Slug",
] as const;

// ─── Generators ───────────────────────────────────────────────────────────────

function pick<T extends readonly unknown[]>(arr: T): T[number] {
  return arr[Math.floor(Math.random() * arr.length)];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generates a random pirate-style name in one of several formats.
 *
 * Formats:
 * - `"Captain Jack Sparrow"`            (Title + Name + Surname)
 * - `"Blackbeard"`                       (Adjective + Noun)
 * - `"The Rotten Barnacle"`              (The + Adjective + Noun)
 * - `"Dread Pirate Roberts"`             (Title + Pirate + Surname)
 * - `"Salty Dog"`                        (Adjective + Insult)
 * - `"Scurvy Jack the Barnacle-Breath"`  (Adjective + Name + the + Insult-Noun)
 * - `"Revenge"`                          (Ship part / Single word)
 */
export function getPirateyName(): string {
  const roll = Math.random();

  // 20% — Full classic pirate name: "Captain Jack Sparrow"
  if (roll < 0.2) {
    const title = pick(TITLES);
    const name = pick(NAMES);
    const noun = pick(NOUNS);
    return `${title} ${name} ${noun}`;
  }

  // 15% — Adjective + Noun compound: "Blackbeard", "Red Shark"
  if (roll < 0.35) {
    const adj = pick(ADJECTIVES);
    const noun = pick(NOUNS);
    return `${adj}${noun}`;
  }

  // 12% — "The [Adjective] [Noun]": "The Rotten Barnacle"
  if (roll < 0.47) {
    return `The ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  }

  // 10% — "Dread Pirate [Surname]": "Dread Pirate Silver"
  if (roll < 0.57) {
    return `Dread Pirate ${pick(NAMES)}`;
  }

  // 10% — "Adjective + Insult": "Salty Dog", "Rotten Rat"
  if (roll < 0.67) {
    return `${pick(ADJECTIVES)} ${pick(INSULTS)}`;
  }

  // 10% — "Adjective Name the [Insult]-[Noun]": "Scurvy Jack the Barnacle-Breath"
  if (roll < 0.77) {
    const adj = pick(ADJECTIVES);
    const name = pick(NAMES);
    const insult = pick(INSULTS);
    const noun = pick(NOUNS);
    return `${adj} ${name} the ${insult}-${noun}`;
  }

  // 10% — Ship name / single dramatic word: "Revenge", "Sea Serpent"
  if (roll < 0.87) {
    const part1 = pick(SHIP_PARTS);
    const part2 = pick(NOUNS);
    // 50% chance of two words
    if (Math.random() < 0.5) {
      return `${part1} ${part2}`;
    }
    return String(part1);
  }

  // 8% — "Title the [Adjective]": "Captain the Fearsome"
  if (roll < 0.95) {
    return `${pick(TITLES)} the ${pick(ADJECTIVES)}`;
  }

  // 5% — Full colourful: "Old Peg the Sea Dog"
  const title = pick(TITLES);
  const name = pick(NAMES);
  const insult = pick(INSULTS);
  const noun = pick(NOUNS);
  return `${title} ${name} the ${insult} ${noun}`;
}

// ─── Convenience Exports ──────────────────────────────────────────────────────

/** Generates a simple, short pirate name (1-3 words, no long epithets). */
export function getShortPirateName(): string {
  const formats = [
    () => `${pick(ADJECTIVES)} ${pick(INSULTS)}`, // "Salty Dog"
    () => `${pick(NAMES)} the ${pick(NOUNS)}`, // "Jack the Shark"
    () => `${pick(TITLES)} ${pick(NAMES)}`, // "Captain Jack"
    () => pick(SHIP_PARTS) as string, // "Revenge"
    () => `${pick(ADJECTIVES)} ${pick(NAMES)}`, // "Black Jack"
  ];
  return pick(formats)();
}

/** Works well for room names: replaces spaces with hyphens, lowercased. */
export function getPirateyRoomName(): string {
  return getPirateyName()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, ""); // strip punctuation like quotes/apostrophes
}
