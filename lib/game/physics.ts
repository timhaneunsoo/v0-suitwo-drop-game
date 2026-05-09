import Matter from "matter-js";
import type { GameDimensions, GameToken, Particle } from "./types";
import { getTokenConfig, MAX_TOKEN_LEVEL } from "./tokenConfig";

const { Engine, World, Bodies, Body, Events } = Matter;

export function createEngine() {
  const engine = Engine.create({
    gravity: { x: 0, y: 0.6 }, // Reduced gravity for slower, floatier drops
  });
  engine.world.gravity.scale = 0.0008; // Lower scale for gentler acceleration
  return engine;
}

export function createWalls(dimensions: GameDimensions) {
  const { width, height, wallThickness } = dimensions;
  
  const options = {
    isStatic: true,
    friction: 0.4, // Slightly higher friction for smoother contact
    restitution: 0.05, // Lower bounce off walls
    render: { visible: false },
    label: "wall",
  };

  // Left wall
  const leftWall = Bodies.rectangle(
    wallThickness / 2,
    height / 2,
    wallThickness,
    height,
    options
  );

  // Right wall
  const rightWall = Bodies.rectangle(
    width - wallThickness / 2,
    height / 2,
    wallThickness,
    height,
    options
  );

  // Floor
  const floor = Bodies.rectangle(
    width / 2,
    height - wallThickness / 2,
    width,
    wallThickness,
    options
  );

  return [leftWall, rightWall, floor];
}

export function createTokenBody(
  x: number,
  y: number,
  level: number,
  id: string
): Matter.Body {
  const config = getTokenConfig(level);
  
  const body = Bodies.circle(x, y, config.radius, {
    restitution: 0.4, // Higher bounce for more reactive ball-to-ball collisions
    friction: 0.2, // Lower friction so balls push each other more
    frictionAir: 0.012, // Air resistance for floaty drops
    density: 0.0006 * (1 + level * 0.08), // Lighter so they move more on impact
    slop: 0.01, // Tighter collision response
    label: "token",
  });

  // Store custom data on the body
  (body as any).tokenId = id;
  (body as any).tokenLevel = level;

  return body;
}

export function setupCollisionHandler(
  engine: Matter.Engine,
  tokens: Map<string, GameToken>,
  onMerge: (token1: GameToken, token2: GameToken) => void
) {
  const mergeQueue: Array<{ id1: string; id2: string }> = [];
  let processingMerge = false;

  Events.on(engine, "collisionStart", (event) => {
    for (const pair of event.pairs) {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      // Skip if either is a wall
      if (bodyA.label === "wall" || bodyB.label === "wall") continue;

      const idA = (bodyA as any).tokenId;
      const idB = (bodyB as any).tokenId;

      if (!idA || !idB) continue;

      const tokenA = tokens.get(idA);
      const tokenB = tokens.get(idB);

      if (!tokenA || !tokenB) continue;

      // Check if same level and not already merging
      if (
        tokenA.level === tokenB.level &&
        !tokenA.merging &&
        !tokenB.merging &&
        tokenA.level < MAX_TOKEN_LEVEL
      ) {
        // Mark both as merging to prevent double merges
        tokenA.merging = true;
        tokenB.merging = true;
        mergeQueue.push({ id1: idA, id2: idB });
      }
    }
  });

  // Process merge queue in animation frame
  function processMergeQueue() {
    if (processingMerge || mergeQueue.length === 0) return;
    
    processingMerge = true;
    const merge = mergeQueue.shift()!;
    
    const token1 = tokens.get(merge.id1);
    const token2 = tokens.get(merge.id2);

    if (token1 && token2 && token1.merging && token2.merging) {
      onMerge(token1, token2);
    }
    
    processingMerge = false;
  }

  return { processMergeQueue };
}

export function createParticles(
  x: number,
  y: number,
  color: string,
  count: number = 12
): Particle[] {
  const particles: Particle[] = [];
  
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 2 + Math.random() * 3;
    
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 3 + Math.random() * 4,
      color,
      alpha: 1,
      decay: 0.02 + Math.random() * 0.02,
    });
  }
  
  return particles;
}

export function updateParticles(particles: Particle[]): Particle[] {
  return particles.filter((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1; // gravity
    p.alpha -= p.decay;
    return p.alpha > 0;
  });
}
