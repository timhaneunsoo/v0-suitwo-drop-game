import type { TokenConfig } from "./types";

// Token progression from smallest to largest
// Colors use warm lofi/crypto vibes - teals, purples, golds
export const TOKEN_CONFIGS: TokenConfig[] = [
  {
    level: 1,
    label: "L1",
    radius: 18,
    scoreValue: 1,
    colorA: "#4ade80", // green
    colorB: "#22c55e",
  },
  {
    level: 2,
    label: "L2",
    radius: 26,
    scoreValue: 3,
    colorA: "#2dd4bf", // teal
    colorB: "#14b8a6",
  },
  {
    level: 3,
    label: "L3",
    radius: 34,
    scoreValue: 6,
    colorA: "#38bdf8", // sky blue
    colorB: "#0ea5e9",
  },
  {
    level: 4,
    label: "L4",
    radius: 44,
    scoreValue: 10,
    colorA: "#818cf8", // indigo
    colorB: "#6366f1",
  },
  {
    level: 5,
    label: "L5",
    radius: 54,
    scoreValue: 15,
    colorA: "#c084fc", // purple
    colorB: "#a855f7",
  },
  {
    level: 6,
    label: "L6",
    radius: 66,
    scoreValue: 21,
    colorA: "#f472b6", // pink
    colorB: "#ec4899",
  },
  {
    level: 7,
    label: "L7",
    radius: 78,
    scoreValue: 28,
    colorA: "#fb923c", // orange
    colorB: "#f97316",
  },
  {
    level: 8,
    label: "🐋",
    radius: 92,
    scoreValue: 36,
    colorA: "#fbbf24", // gold
    colorB: "#f59e0b",
  },
];

export const MAX_TOKEN_LEVEL = TOKEN_CONFIGS.length;

// Only allow dropping small tokens (levels 1-4) randomly
export const DROPPABLE_LEVELS = [1, 2, 3, 4];

export function getTokenConfig(level: number): TokenConfig {
  return TOKEN_CONFIGS[level - 1] || TOKEN_CONFIGS[0];
}

export function getRandomDroppableLevel(): number {
  const weights = [40, 30, 20, 10]; // Higher chance for smaller tokens
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < DROPPABLE_LEVELS.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return DROPPABLE_LEVELS[i];
    }
  }
  
  return DROPPABLE_LEVELS[0];
}
