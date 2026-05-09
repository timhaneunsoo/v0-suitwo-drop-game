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

const STORAGE_KEY = "lofi-drop-best-score";
const DROP_COOLDOWN = 500; // ms
const DANGER_TIME = 2000; // ms before game over when above danger line
const GAME_ASPECT_RATIO = 0.6; // width / height

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function LofiDropGame() {
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
    setCurrentTokenLevel(getRandomDroppableLevel());
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
    setCurrentTokenLevel(nextTokenLevel);
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
    const config = getTokenConfig(currentTokenLevel);
    
    // Clamp to valid range
    const minX = dims.wallThickness + config.radius;
    const maxX = dims.width - dims.wallThickness - config.radius;
    const clampedX = Math.max(minX, Math.min(maxX, x));

    previewXRef.current = clampedX;
    setPreviewX(clampedX);
  }, [currentTokenLevel, gameOver]);

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

    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, dims.width, dims.height);

    // Draw container background
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(
      dims.wallThickness,
      dims.dangerLineY,
      dims.width - dims.wallThickness * 2,
      dims.height - dims.dangerLineY - dims.wallThickness
    );

    // Draw danger line
    ctx.strokeStyle = "#ef444480";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(dims.wallThickness, dims.dangerLineY);
    ctx.lineTo(dims.width - dims.wallThickness, dims.dangerLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw walls
    ctx.fillStyle = "#334155";
    // Left wall
    ctx.fillRect(0, 0, dims.wallThickness, dims.height);
    // Right wall
    ctx.fillRect(dims.width - dims.wallThickness, 0, dims.wallThickness, dims.height);
    // Floor
    ctx.fillRect(0, dims.height - dims.wallThickness, dims.width, dims.wallThickness);

    // Draw drop preview line
    if (!gameOver && canDrop) {
      ctx.strokeStyle = "#ffffff20";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(previewXRef.current, dims.dropZoneY);
      ctx.lineTo(previewXRef.current, dims.dangerLineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw preview token
      const config = getTokenConfig(currentTokenLevel);
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
  }, [currentTokenLevel, gameOver, canDrop]);

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
      gradient.addColorStop(1, config.colorB);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, config.radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.beginPath();
      ctx.ellipse(
        -config.radius * 0.2,
        -config.radius * 0.3,
        config.radius * 0.4,
        config.radius * 0.25,
        -0.5,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Draw border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, config.radius - 1, 0, Math.PI * 2);
      ctx.stroke();

      // Draw label
      ctx.fillStyle = "white";
      ctx.font = `bold ${config.radius * 0.5}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(config.label, 0, 0);
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
        className="relative bg-card/30 backdrop-blur-sm rounded-2xl p-3 border border-border/50 shadow-2xl"
      >
        <canvas
          ref={canvasRef}
          className="rounded-xl cursor-crosshair touch-none transition-transform"
          style={{ display: "block" }}
        />
        
        {/* Instructions overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/60 text-center pointer-events-none">
          Move to aim • Click/Tap to drop
        </div>
      </div>

      {/* HUD */}
      <div className="lg:sticky lg:top-4 w-full lg:w-64">
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
