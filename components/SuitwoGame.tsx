"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";
import { GameHud, GameOverModal } from "./GameHud";
import {
  createEngine,
  createWalls,
  createTokenBody,
  setupCollisionHandler,
  createParticles,
  updateParticles,
} from "@/lib/game/physics";
import {
  getTokenConfig,
  getRandomDroppableLevel,
  MAX_TOKEN_LEVEL,
} from "@/lib/game/tokenConfig";
import type { GameToken, Particle, GameDimensions } from "@/lib/game/types";

const STORAGE_KEY = "suitwo-best-score";
const DROP_COOLDOWN = 500; // ms
const DANGER_TIME = 2000; // ms before game over when above danger line
const GAME_ASPECT_RATIO = 0.6; // width / height

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function SuitwoGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs for mutable game state (not triggering re-renders)
  const engineRef = useRef<Matter.Engine | null>(null);
  const tokensRef = useRef<Map<string, GameToken>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>(0);
  const lastDropTimeRef = useRef<number>(0);
  const dangerStartTimeRef = useRef<number | null>(null);
  const dimensionsRef = useRef<GameDimensions>({
    width: 360,
    height: 600,
    wallThickness: 20,
    dangerLineY: 80,
    dropZoneY: 50,
  });
  const mergeHandlerRef = useRef<{ processMergeQueue: () => void } | null>(null);
  const previewXRef = useRef<number>(180);
  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const currentTokenLevelRef = useRef<number>(1);

  // React state for UI updates
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [currentTokenLevel, setCurrentTokenLevel] = useState(1);
  const [nextTokenLevel, setNextTokenLevel] = useState(1);
  const [canDrop, setCanDrop] = useState(true);
  const [previewX, setPreviewX] = useState(180);

  // Load best score from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setBestScore(parseInt(saved, 10));
    }
  }, []);

  // Initialize game
  const initGame = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Clean up previous game
    if (engineRef.current) {
      Matter.Engine.clear(engineRef.current);
      Matter.World.clear(engineRef.current.world, false);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Calculate dimensions based on container
    const containerWidth = container.clientWidth;
    const maxHeight = Math.min(window.innerHeight * 0.65, 700);
    const height = maxHeight;
    const width = Math.min(containerWidth, height * GAME_ASPECT_RATIO);
    
    const dims: GameDimensions = {
      width,
      height,
      wallThickness: 15,
      dangerLineY: height * 0.12,
      dropZoneY: height * 0.08,
    };
    dimensionsRef.current = dims;

    // Set up canvas with devicePixelRatio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.width * dpr;
    canvas.height = dims.height * dpr;
    canvas.style.width = `${dims.width}px`;
    canvas.style.height = `${dims.height}px`;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    // Create physics engine
    const engine = createEngine();
    engineRef.current = engine;

    // Create walls
    const walls = createWalls(dims);
    Matter.World.add(engine.world, walls);

    // Reset game state
    tokensRef.current.clear();
    particlesRef.current = [];
    dangerStartTimeRef.current = null;
    lastDropTimeRef.current = 0;
    previewXRef.current = dims.width / 2;

    // Set up collision handling
    mergeHandlerRef.current = setupCollisionHandler(
      engine,
      tokensRef.current,
      handleMerge
    );

    // Reset React state
    setScore(0);
    setGameOver(false);
    setIsNewBest(false);
    setCanDrop(true);
    const initialLevel = getRandomDroppableLevel();
    setCurrentTokenLevel(initialLevel);
    currentTokenLevelRef.current = initialLevel;
    setNextTokenLevel(getRandomDroppableLevel());
    setPreviewX(dims.width / 2);

    // Start game loop
    gameLoop();
  }, []);

  // Handle token merge
  const handleMerge = useCallback((token1: GameToken, token2: GameToken) => {
    const engine = engineRef.current;
    if (!engine) return;

    // Calculate midpoint
    const midX = (token1.body.position.x + token2.body.position.x) / 2;
    const midY = (token1.body.position.y + token2.body.position.y) / 2;
    const newLevel = token1.level + 1;

    // Remove old tokens
    Matter.World.remove(engine.world, token1.body);
    Matter.World.remove(engine.world, token2.body);
    tokensRef.current.delete(token1.id);
    tokensRef.current.delete(token2.id);

    // Create new token
    const newId = generateId();
    const newBody = createTokenBody(midX, midY, newLevel, newId);
    Matter.World.add(engine.world, newBody);
    
    tokensRef.current.set(newId, {
      body: newBody,
      level: newLevel,
      id: newId,
      merging: false,
      createdAt: Date.now(),
    });

    // Add score
    const config = getTokenConfig(newLevel);
    setScore((prev) => prev + config.scoreValue);

    // Create particles
    const particles = createParticles(midX, midY, config.colorA, newLevel > 5 ? 20 : 12);
    particlesRef.current.push(...particles);

    // Add screen shake for high-level merges
    if (newLevel >= 6) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.transform = `translate(${(Math.random() - 0.5) * 8}px, ${(Math.random() - 0.5) * 8}px)`;
        setTimeout(() => {
          canvas.style.transform = "";
        }, 100);
      }
    }
  }, []);

  // Drop token
  const dropToken = useCallback(() => {
    const engine = engineRef.current;
    const dims = dimensionsRef.current;
    if (!engine || gameOver) return;

    const now = Date.now();
    if (now - lastDropTimeRef.current < DROP_COOLDOWN) return;

    // Clamp preview X to valid range
    const config = getTokenConfig(currentTokenLevel);
    const minX = dims.wallThickness + config.radius;
    const maxX = dims.width - dims.wallThickness - config.radius;
    const dropX = Math.max(minX, Math.min(maxX, previewXRef.current));

    // Create token
    const id = generateId();
    const body = createTokenBody(dropX, dims.dropZoneY, currentTokenLevel, id);
    Matter.World.add(engine.world, body);

    tokensRef.current.set(id, {
      body,
      level: currentTokenLevel,
      id,
      merging: false,
      createdAt: Date.now(),
    });

    // Update state
    lastDropTimeRef.current = now;
    setCanDrop(false);
    const newCurrentLevel = nextTokenLevel;
    setCurrentTokenLevel(newCurrentLevel);
    currentTokenLevelRef.current = newCurrentLevel;
    setNextTokenLevel(getRandomDroppableLevel());

    // Re-enable drop after cooldown
    setTimeout(() => {
      setCanDrop(true);
    }, DROP_COOLDOWN);
  }, [currentTokenLevel, nextTokenLevel, gameOver]);

  // Handle mouse/touch movement
  const handlePointerMove = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || gameOver) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const dims = dimensionsRef.current;
    const config = getTokenConfig(currentTokenLevelRef.current);
    
    // Clamp to valid range
    const minX = dims.wallThickness + config.radius;
    const maxX = dims.width - dims.wallThickness - config.radius;
    const clampedX = Math.max(minX, Math.min(maxX, x));

    previewXRef.current = clampedX;
    setPreviewX(clampedX);
  }, [gameOver]);

  // Check for game over condition
  const checkGameOver = useCallback(() => {
    const dims = dimensionsRef.current;
    const tokens = tokensRef.current;
    const now = Date.now();

    let anyAboveLine = false;

    for (const token of tokens.values()) {
      const config = getTokenConfig(token.level);
      const topY = token.body.position.y - config.radius;
      
      // Check if token is settled (low velocity) and above danger line
      const velocity = token.body.velocity;
      const isSettled = Math.abs(velocity.x) < 0.5 && Math.abs(velocity.y) < 0.5;
      const isAboveLine = topY < dims.dangerLineY;
      const isOldEnough = now - token.createdAt > 1000; // Ignore newly dropped tokens

      if (isSettled && isAboveLine && isOldEnough) {
        anyAboveLine = true;
        break;
      }
    }

    if (anyAboveLine) {
      if (dangerStartTimeRef.current === null) {
        dangerStartTimeRef.current = now;
      } else if (now - dangerStartTimeRef.current >= DANGER_TIME) {
        return true; // Game over!
      }
    } else {
      dangerStartTimeRef.current = null;
    }

    return false;
  }, []);

  // End game
  const endGame = useCallback(() => {
    setGameOver(true);
    
    // Check for new best score
    setScore((currentScore) => {
      const savedBest = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
      if (currentScore > savedBest) {
        localStorage.setItem(STORAGE_KEY, currentScore.toString());
        setBestScore(currentScore);
        setIsNewBest(true);
      }
      return currentScore;
    });
  }, []);

  // Main game loop
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !engine || !ctx || gameOver) {
      return;
    }

    // Update physics
    Matter.Engine.update(engine, 1000 / 60);

    // Process merge queue
    mergeHandlerRef.current?.processMergeQueue();

    // Check game over
    if (checkGameOver()) {
      endGame();
      return;
    }

    // Update particles
    particlesRef.current = updateParticles(particlesRef.current);

    // Render
    render(ctx);

    // Continue loop
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [gameOver, checkGameOver, endGame]);

  // Render game
  const render = useCallback((ctx: CanvasRenderingContext2D) => {
    const dims = dimensionsRef.current;

    // Clear canvas with deep space gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, dims.height);
    bgGradient.addColorStop(0, "#0c0a1a");
    bgGradient.addColorStop(0.5, "#120f24");
    bgGradient.addColorStop(1, "#0a0814");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, dims.width, dims.height);

    // Draw subtle grid pattern
    ctx.strokeStyle = "rgba(139, 92, 246, 0.03)";
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = dims.wallThickness; x < dims.width - dims.wallThickness; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, dims.dangerLineY);
      ctx.lineTo(x, dims.height - dims.wallThickness);
      ctx.stroke();
    }
    for (let y = dims.dangerLineY; y < dims.height - dims.wallThickness; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(dims.wallThickness, y);
      ctx.lineTo(dims.width - dims.wallThickness, y);
      ctx.stroke();
    }

    // Draw container background with gradient
    const containerGradient = ctx.createLinearGradient(0, dims.dangerLineY, 0, dims.height);
    containerGradient.addColorStop(0, "rgba(139, 92, 246, 0.05)");
    containerGradient.addColorStop(0.5, "rgba(34, 211, 238, 0.02)");
    containerGradient.addColorStop(1, "rgba(139, 92, 246, 0.08)");
    ctx.fillStyle = containerGradient;
    ctx.fillRect(
      dims.wallThickness,
      dims.dangerLineY,
      dims.width - dims.wallThickness * 2,
      dims.height - dims.dangerLineY - dims.wallThickness
    );

    // Draw danger line with glow
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "#ef444480";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(dims.wallThickness, dims.dangerLineY);
    ctx.lineTo(dims.width - dims.wallThickness, dims.dangerLineY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Draw walls with gradient
    const wallGradient = ctx.createLinearGradient(0, 0, dims.wallThickness, 0);
    wallGradient.addColorStop(0, "#1a1530");
    wallGradient.addColorStop(1, "#251f45");
    ctx.fillStyle = wallGradient;
    // Left wall
    ctx.fillRect(0, 0, dims.wallThickness, dims.height);
    
    const wallGradientRight = ctx.createLinearGradient(dims.width - dims.wallThickness, 0, dims.width, 0);
    wallGradientRight.addColorStop(0, "#251f45");
    wallGradientRight.addColorStop(1, "#1a1530");
    ctx.fillStyle = wallGradientRight;
    // Right wall
    ctx.fillRect(dims.width - dims.wallThickness, 0, dims.wallThickness, dims.height);
    
    // Floor
    const floorGradient = ctx.createLinearGradient(0, dims.height - dims.wallThickness, 0, dims.height);
    floorGradient.addColorStop(0, "#251f45");
    floorGradient.addColorStop(1, "#1a1530");
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, dims.height - dims.wallThickness, dims.width, dims.wallThickness);
    
    // Wall edge highlights
    ctx.strokeStyle = "rgba(139, 92, 246, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dims.wallThickness, dims.dangerLineY);
    ctx.lineTo(dims.wallThickness, dims.height - dims.wallThickness);
    ctx.moveTo(dims.width - dims.wallThickness, dims.dangerLineY);
    ctx.lineTo(dims.width - dims.wallThickness, dims.height - dims.wallThickness);
    ctx.stroke();

    // Draw drop preview line
    if (!gameOver && canDrop) {
      // Glowing preview line
      ctx.shadowColor = "rgba(139, 92, 246, 0.5)";
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(previewXRef.current, dims.dropZoneY);
      ctx.lineTo(previewXRef.current, dims.dangerLineY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Draw preview token - use ref for current level to avoid stale closure
      const config = getTokenConfig(currentTokenLevelRef.current);
      drawToken(ctx, previewXRef.current, dims.dropZoneY, config, 0.7);
    }

    // Draw tokens
    for (const token of tokensRef.current.values()) {
      const config = getTokenConfig(token.level);
      drawToken(
        ctx,
        token.body.position.x,
        token.body.position.y,
        config,
        1,
        token.body.angle
      );
    }

    // Draw particles
    for (const particle of particlesRef.current) {
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [gameOver, canDrop]);

  // Draw individual token
  const drawToken = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    config: ReturnType<typeof getTokenConfig>,
    alpha: number = 1,
    angle: number = 0
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    // Check for preloaded image
    const image = imagesRef.current.get(config.level);
    if (image && config.imageSrc) {
      // Draw glow behind image
      ctx.shadowColor = config.colorA;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, config.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.01)";
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Draw image clipped to circle
      ctx.beginPath();
      ctx.arc(0, 0, config.radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        image,
        -config.radius,
        -config.radius,
        config.radius * 2,
        config.radius * 2
      );
    } else {
      // Outer glow
      ctx.shadowColor = config.colorA;
      ctx.shadowBlur = 20;
      
      // Draw gradient circle
      const gradient = ctx.createRadialGradient(
        -config.radius * 0.3,
        -config.radius * 0.3,
        0,
        0,
        0,
        config.radius
      );
      gradient.addColorStop(0, config.colorA);
      gradient.addColorStop(0.7, config.colorB);
      gradient.addColorStop(1, config.colorB);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, config.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner highlight
      const highlightGradient = ctx.createRadialGradient(
        -config.radius * 0.3,
        -config.radius * 0.4,
        0,
        -config.radius * 0.3,
        -config.radius * 0.4,
        config.radius * 0.5
      );
      highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.35)");
      highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = highlightGradient;
      ctx.beginPath();
      ctx.arc(0, 0, config.radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw border with gradient
      const borderGradient = ctx.createLinearGradient(-config.radius, -config.radius, config.radius, config.radius);
      borderGradient.addColorStop(0, "rgba(255, 255, 255, 0.5)");
      borderGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
      borderGradient.addColorStop(1, "rgba(255, 255, 255, 0.1)");
      ctx.strokeStyle = borderGradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, config.radius - 1, 0, Math.PI * 2);
      ctx.stroke();

      // Draw label with shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = "white";
      ctx.font = `bold ${config.radius * 0.45}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(config.label, 0, 0);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.restore();
  };

  // Set up event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX);
      }
    };
    const handleClick = () => dropToken();
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      dropToken();
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handlePointerMove, dropToken]);

  // Initialize on mount
  useEffect(() => {
    initGame();

    const handleResize = () => {
      // Debounce resize
      clearTimeout((window as any).resizeTimeout);
      (window as any).resizeTimeout = setTimeout(initGame, 250);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (engineRef.current) {
        Matter.Engine.clear(engineRef.current);
      }
    };
  }, [initGame]);

  // Restart game loop when gameOver changes to false
  useEffect(() => {
    if (!gameOver && engineRef.current) {
      gameLoop();
    }
  }, [gameOver, gameLoop]);

  const handleRestart = useCallback(() => {
    initGame();
  }, [initGame]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center w-full max-w-4xl mx-auto p-4">
      {/* Game Canvas */}
      <div
        ref={containerRef}
        className="relative glass-card rounded-3xl p-4 glow-purple"
      >
        {/* Decorative corner accents */}
        <div className="absolute top-2 left-2 w-8 h-8 border-l-2 border-t-2 border-violet-500/30 rounded-tl-xl" />
        <div className="absolute top-2 right-2 w-8 h-8 border-r-2 border-t-2 border-cyan-500/30 rounded-tr-xl" />
        <div className="absolute bottom-2 left-2 w-8 h-8 border-l-2 border-b-2 border-cyan-500/30 rounded-bl-xl" />
        <div className="absolute bottom-2 right-2 w-8 h-8 border-r-2 border-b-2 border-violet-500/30 rounded-br-xl" />
        
        <canvas
          ref={canvasRef}
          className="rounded-2xl cursor-crosshair touch-none transition-transform"
          style={{ display: "block" }}
        />
        
        {/* Instructions overlay */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50 text-center pointer-events-none font-mono tracking-wider uppercase">
          Move to aim • Click/Tap to drop
        </div>
      </div>

      {/* HUD */}
      <div className="lg:sticky lg:top-4 w-full lg:w-72">
        <GameHud
          score={score}
          bestScore={bestScore}
          currentTokenLevel={currentTokenLevel}
          nextTokenLevel={nextTokenLevel}
          canDrop={canDrop}
          onRestart={handleRestart}
        />
      </div>

      {/* Game Over Modal */}
      {gameOver && (
        <GameOverModal
          score={score}
          bestScore={bestScore}
          isNewBest={isNewBest}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
