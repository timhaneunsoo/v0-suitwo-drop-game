import type { Body } from "matter-js";

export type TokenConfig = {
  level: number;
  label: string;
  radius: number;
  scoreValue: number;
  colorA: string;
  colorB: string;
  imageSrc?: string;
};

export type GameToken = {
  body: Body;
  level: number;
  id: string;
  merging: boolean;
  createdAt: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
};

export type GameState = {
  score: number;
  bestScore: number;
  gameOver: boolean;
  currentTokenLevel: number;
  nextTokenLevel: number;
  canDrop: boolean;
  previewX: number;
};

export type GameDimensions = {
  width: number;
  height: number;
  wallThickness: number;
  dangerLineY: number;
  dropZoneY: number;
};
