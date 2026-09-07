const seaTerms = [
  "Ocean",
  "Deep",
  "Waters",
  "Main",
  "Brine",
  "Blue",
  "Abyss",
  "Billow",
  "Tide",
  "Surge",
  "Gulf",
  "Bay",
  "Sound",
  "Inlet",
  "Strait",
  "Channel",
  "Roadstead",
  "Firth",
  "Thalassic",
  "Pelagic",
  "Bight",
  "Estuary",
] as const;

const battleTerms = [
  "Clash",
  "Conflict",
  "Warfare",
  "Assault",
  "Strike",
  "Hostilities",
  "Broadside",
  "Offensive",
  "Brawl",
  "Skirmish",
  "Fray",
  "Carnage",
  "Melee",
  "Combat",
  "Siege",
  "Onslaught",
  "Engagement",
  "Campaign",
  "Encounter",
  "Duel",
  "Ambush",
  "Blockade",
  "Raid",
] as const;

export const MAX_COMBINATIONS = seaTerms.length * battleTerms.length;

/**
 * Generates random battleships war room name
 * // Example output: "Gulf-Broadside", "Deep-Assault", "Pelagic-Strike"
 * console.log(generateWarRoomName());
 * @param delimiter
 * @returns
 */
export function generateWarRoomName(delimiter: string = "-"): string {
  const sea = seaTerms[Math.floor(Math.random() * seaTerms.length)];
  const battle = battleTerms[Math.floor(Math.random() * battleTerms.length)];
  return `${sea}${delimiter}${battle}`;
}
