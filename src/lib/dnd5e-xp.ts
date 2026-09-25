/**
 * D&D 5e Experience Points (PX / XP) System & Calculator
 * Official 5th Edition SRD / DMG Rules and Calculations
 */

// Official D&D 5e XP Progression Table for Levels 1 to 20
export const DND5E_LEVEL_XP: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

// Encounter Difficulty XP Thresholds per Character Level (Easy, Medium, Hard, Deadly, Daily Budget)
export const DND5E_ENCOUNTER_THRESHOLDS: Record<number, { easy: number; medium: number; hard: number; deadly: number; daily: number }> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100, daily: 300 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200, daily: 600 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400, daily: 1200 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500, daily: 1600 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100, daily: 3500 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400, daily: 4000 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700, daily: 5000 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100, daily: 6000 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400, daily: 7500 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800, daily: 9000 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600, daily: 10500 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500, daily: 11500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100, daily: 13500 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700, daily: 15000 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400, daily: 18000 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200, daily: 20000 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800, daily: 25000 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500, daily: 27000 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900, daily: 30000 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700, daily: 40000 },
};

// Challenge Rating (CR / GS) to XP mapping
export const DND5E_CR_XP: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

// Non-Combat Award Guidelines by Tier
export interface NonCombatXpSuggestion {
  category: 'Traguardo Minore' | 'Traguardo Maggiore' | 'Enigma / Trappola Complessa' | 'Interpretazione / Dilemma PG' | 'Esplorazione & Segreti';
  label: string;
  tier1: number; // Livelli 1-4
  tier2: number; // Livelli 5-10
  tier3: number; // Livelli 11-16
  tier4: number; // Livelli 17-20
}

export const DND5E_NON_COMBAT_XP: NonCombatXpSuggestion[] = [
  {
    category: 'Traguardo Minore',
    label: 'Completamento di un obiettivo secondario o informazione cruciale scoperta',
    tier1: 100,
    tier2: 500,
    tier3: 1500,
    tier4: 3000,
  },
  {
    category: 'Traguardo Maggiore',
    label: 'Conclusione trionfale della quest principale o salvataggio di una fazione/città',
    tier1: 300,
    tier2: 1500,
    tier3: 4500,
    tier4: 9000,
  },
  {
    category: 'Enigma / Trappola Complessa',
    label: 'Risoluzione brillante di un enigma o disattivazione trappola letale',
    tier1: 75,
    tier2: 350,
    tier3: 1000,
    tier4: 2500,
  },
  {
    category: 'Interpretazione / Dilemma PG',
    label: 'Scelta morale difficile coerente con ideali/difetti o roleplay ispirato',
    tier1: 50,
    tier2: 250,
    tier3: 750,
    tier4: 1500,
  },
  {
    category: 'Esplorazione & Segreti',
    label: 'Scoperta di una via alternativa, scorciatoia o reliquia celata',
    tier1: 50,
    tier2: 200,
    tier3: 600,
    tier4: 1200,
  },
];

/**
 * Calculates level from total experience points (D&D 5e standard)
 */
export function getLevelFromXp(xp: number): number {
  const currentXp = Math.max(0, xp || 0);
  for (let lvl = 20; lvl >= 1; lvl--) {
    if (currentXp >= DND5E_LEVEL_XP[lvl]) {
      return lvl;
    }
  }
  return 1;
}

/**
 * Gets XP needed for next level and percentage progress
 */
export function getXpProgress(currentXp: number): {
  currentLevel: number;
  nextLevel: number;
  currentLevelBaseXp: number;
  nextLevelXp: number;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  progressPercent: number;
  isMaxLevel: boolean;
} {
  const xp = Math.max(0, currentXp || 0);
  const currentLevel = getLevelFromXp(xp);
  
  if (currentLevel >= 20) {
    return {
      currentLevel: 20,
      nextLevel: 20,
      currentLevelBaseXp: DND5E_LEVEL_XP[20],
      nextLevelXp: DND5E_LEVEL_XP[20],
      xpInCurrentLevel: xp - DND5E_LEVEL_XP[20],
      xpNeededForNextLevel: 0,
      progressPercent: 100,
      isMaxLevel: true,
    };
  }

  const currentLevelBaseXp = DND5E_LEVEL_XP[currentLevel];
  const nextLevelXp = DND5E_LEVEL_XP[currentLevel + 1];
  const xpInCurrentLevel = xp - currentLevelBaseXp;
  const xpSpan = nextLevelXp - currentLevelBaseXp;
  const xpNeededForNextLevel = Math.max(0, nextLevelXp - xp);
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / xpSpan) * 100)));

  return {
    currentLevel,
    nextLevel: currentLevel + 1,
    currentLevelBaseXp,
    nextLevelXp,
    xpInCurrentLevel,
    xpNeededForNextLevel,
    progressPercent,
    isMaxLevel: false,
  };
}

/**
 * Evaluates the encounter difficulty for a given party
 */
export function evaluateEncounterDifficulty(
  partyLevels: number[],
  totalMonsterXp: number
): {
  difficulty: 'Facile' | 'Medio' | 'Difficile' | 'Mortale' | 'Triviale';
  partyThresholds: { easy: number; medium: number; hard: number; deadly: number; daily: number };
} {
  const partyThresholds = partyLevels.reduce(
    (acc, lvl) => {
      const t = DND5E_ENCOUNTER_THRESHOLDS[Math.min(20, Math.max(1, lvl))] || DND5E_ENCOUNTER_THRESHOLDS[1];
      acc.easy += t.easy;
      acc.medium += t.medium;
      acc.hard += t.hard;
      acc.deadly += t.deadly;
      acc.daily += t.daily;
      return acc;
    },
    { easy: 0, medium: 0, hard: 0, deadly: 0, daily: 0 }
  );

  let difficulty: 'Facile' | 'Medio' | 'Difficile' | 'Mortale' | 'Triviale' = 'Triviale';
  if (totalMonsterXp >= partyThresholds.deadly) {
    difficulty = 'Mortale';
  } else if (totalMonsterXp >= partyThresholds.hard) {
    difficulty = 'Difficile';
  } else if (totalMonsterXp >= partyThresholds.medium) {
    difficulty = 'Medio';
  } else if (totalMonsterXp >= partyThresholds.easy) {
    difficulty = 'Facile';
  }

  return { difficulty, partyThresholds };
}
