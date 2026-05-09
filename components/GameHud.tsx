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
const MIN_PREVIEW_SIZE = 36;
const MAX_PREVIEW_SIZE = 68;
const MIN_RADIUS = 18;
const MAX_RADIUS = 92;

function TokenPreview({ level, label }: { level: number; label: string }) {
  const config = getTokenConfig(level);
  
  const normalizedRadius = (config.radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS);
  const previewSize = MIN_PREVIEW_SIZE + normalizedRadius * (MAX_PREVIEW_SIZE - MIN_PREVIEW_SIZE);
  
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-mono">{label}</span>
      <div className="relative">
        {/* Glow ring */}
        <div 
          className="absolute inset-0 rounded-full opacity-50 blur-md"
          style={{
            background: `linear-gradient(135deg, ${config.colorA}, ${config.colorB})`,
            transform: 'scale(1.2)',
          }}
        />
        {/* Token */}
        <div
          className="relative rounded-full flex items-center justify-center font-bold text-white transition-all duration-300"
          style={{
            width: previewSize,
            height: previewSize,
            background: `linear-gradient(135deg, ${config.colorA} 0%, ${config.colorB} 100%)`,
            boxShadow: `0 0 20px ${config.colorA}60, inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.2)`,
            fontSize: previewSize * 0.32,
          }}
        >
          {config.label}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="glass-card rounded-xl px-5 py-3 min-w-[110px] text-center">
      <div className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-mono mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${highlight ? 'bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent' : 'text-foreground'}`}>
        {value.toLocaleString()}
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
    <div className="flex flex-col gap-5 w-full">
      {/* Score Cards */}
      <div className="flex gap-3 justify-center">
        <StatCard label="Score" value={score} />
        <StatCard label="Best" value={bestScore} highlight />
      </div>

      {/* Token Previews */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex gap-8 justify-center items-end">
          <TokenPreview level={currentTokenLevel} label="Current" />
          <div className="w-px h-16 bg-gradient-to-b from-transparent via-border to-transparent" />
          <TokenPreview level={nextTokenLevel} label="Next" />
        </div>
      </div>

      {/* Drop Indicator */}
      <div className="flex justify-center">
        <div
          className={`text-xs px-4 py-1.5 rounded-full font-mono tracking-wider transition-all duration-300 ${
            canDrop
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          }`}
          style={{
            boxShadow: canDrop ? '0 0 20px rgba(16,185,129,0.2)' : 'none',
          }}
        >
          {canDrop ? "READY" : "COOLDOWN"}
        </div>
      </div>

      {/* Restart Button */}
      <button
        onClick={onRestart}
        className="mx-auto px-6 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary/80 text-secondary-foreground font-medium transition-all duration-200 text-sm border border-border/50 hover:border-border hover:scale-105 active:scale-95"
        aria-label="Restart game"
      >
        Restart Game
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-3xl p-8 max-w-sm w-full text-center glow-purple relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-gradient-to-b from-violet-500/20 to-transparent rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-foreground mb-3 tracking-tight">Game Over</h2>
          
          {isNewBest && (
            <div className="inline-block px-4 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-4">
              <span className="text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                NEW HIGH SCORE
              </span>
            </div>
          )}

          <div className="space-y-3 mb-6">
            <div className="glass-card rounded-xl p-5">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Final Score</div>
              <div className="text-5xl font-bold text-foreground tabular-nums">{score.toLocaleString()}</div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Best Score</div>
              <div className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent tabular-nums">
                {bestScore.toLocaleString()}
              </div>
            </div>
          </div>

          <button
            onClick={onRestart}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold text-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-violet-500/25"
            aria-label="Play again"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
