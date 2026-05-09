"use client";

import { getTokenConfig } from "@/lib/game/tokenConfig";

type GameHudProps = {
  score: number;
  bestScore: number;
  currentTokenLevel: number;
  nextTokenLevel: number;
  canDrop: boolean;
  onRestart: () => void;
};

// Scale factor to convert game radius to HUD preview size
// Game radius ranges from 18 (L1) to 92 (L8)
// We want HUD preview to range from ~32px to ~64px
const MIN_PREVIEW_SIZE = 32;
const MAX_PREVIEW_SIZE = 64;
const MIN_RADIUS = 18;
const MAX_RADIUS = 92;

function TokenPreview({ level, label }: { level: number; label: string }) {
  const config = getTokenConfig(level);
  
  // Scale the token's actual radius to a reasonable HUD preview size
  const normalizedRadius = (config.radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS);
  const previewSize = MIN_PREVIEW_SIZE + normalizedRadius * (MAX_PREVIEW_SIZE - MIN_PREVIEW_SIZE);
  
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <div
        className="rounded-full flex items-center justify-center font-bold text-white shadow-lg transition-all duration-200"
        style={{
          width: previewSize,
          height: previewSize,
          background: `linear-gradient(135deg, ${config.colorA} 0%, ${config.colorB} 100%)`,
          boxShadow: `0 0 20px ${config.colorA}40, inset 0 2px 4px rgba(255,255,255,0.3)`,
          fontSize: previewSize * 0.35,
        }}
      >
        {config.label}
      </div>
    </div>
  );
}

export function GameHud({
  score,
  bestScore,
  currentTokenLevel,
  nextTokenLevel,
  canDrop,
  onRestart,
}: GameHudProps) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Score Cards */}
      <div className="flex gap-3 justify-center">
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-2 min-w-[100px]">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Score</div>
          <div className="text-2xl font-bold text-foreground tabular-nums">{score}</div>
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-2 min-w-[100px]">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Best</div>
          <div className="text-2xl font-bold text-amber-400 tabular-nums">{bestScore}</div>
        </div>
      </div>

      {/* Token Previews */}
      <div className="flex gap-6 justify-center items-end">
        <TokenPreview level={currentTokenLevel} label="Current" />
        <TokenPreview level={nextTokenLevel} label="Next" />
      </div>

      {/* Drop Indicator */}
      <div className="flex justify-center">
        <div
          className={`text-xs px-3 py-1 rounded-full transition-all duration-200 ${
            canDrop
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
          }`}
        >
          {canDrop ? "Ready to drop" : "Cooldown..."}
        </div>
      </div>

      {/* Restart Button */}
      <button
        onClick={onRestart}
        className="mx-auto px-6 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium transition-colors text-sm"
        aria-label="Restart game"
      >
        Restart
      </button>
    </div>
  );
}

type GameOverModalProps = {
  score: number;
  bestScore: number;
  isNewBest: boolean;
  onRestart: () => void;
};

export function GameOverModal({ score, bestScore, isNewBest, onRestart }: GameOverModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <h2 className="text-3xl font-bold text-foreground mb-2">Game Over</h2>
        
        {isNewBest && (
          <div className="text-amber-400 font-semibold mb-4 animate-pulse">
            🎉 New Best Score! 🎉
          </div>
        )}

        <div className="space-y-3 mb-6">
          <div className="bg-secondary/50 rounded-xl p-4">
            <div className="text-sm text-muted-foreground">Final Score</div>
            <div className="text-4xl font-bold text-foreground">{score}</div>
          </div>
          <div className="bg-secondary/50 rounded-xl p-4">
            <div className="text-sm text-muted-foreground">Best Score</div>
            <div className="text-2xl font-bold text-amber-400">{bestScore}</div>
          </div>
        </div>

        <button
          onClick={onRestart}
          className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg transition-colors"
          aria-label="Play again"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
