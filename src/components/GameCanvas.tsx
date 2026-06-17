import React, { useEffect, useRef, useState } from 'react';
import { GameAction, GameState, Player, Obstacle, Coin, Particle, ParallaxLayer, ObstacleType } from '../types';
import { audioSynth } from './AudioSynth';
import { Play, RotateCcw, Volume2, VolumeX, Shield, Award, Sparkles } from 'lucide-react';

interface GameCanvasProps {
  currentAction: GameAction;
  isWebcamActive: boolean;
  isModelReady: boolean;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_Y = 330;

export default function GameCanvas({ currentAction, isWebcamActive, isModelReady }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('retro_gesture_high_score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [multiplier, setMultiplier] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [screenShake, setScreenShake] = useState(0);

  // Keep references to values needed inside the requestAnimationFrame loop to avoid closures issues
  const stateRef = useRef<{
    gameState: GameState;
    player: Player;
    obstacles: Obstacle[];
    coins: Coin[];
    particles: Particle[];
    layers: ParallaxLayer[];
    score: number;
    multiplier: number;
    comboStreak: number;
    speed: number;
    spawnTimer: number;
    coinSpawnTimer: number;
    currentAction: GameAction;
    screenShake: number;
    levelUpBannerTimer: number;
    level: number;
  }>({
    gameState: 'START',
    player: {
      x: 100,
      y: GROUND_Y - 50,
      width: 32,
      height: 48,
      vx: 0,
      vy: 0,
      isGrounded: true,
      isDucking: false,
      state: 'RUNNING',
      frame: 0,
      frameTimer: 0,
      invulnTimer: 0,
      lives: 3,
    },
    obstacles: [],
    coins: [],
    particles: [],
    layers: [
      { x: 0, speedFactor: 0.1, color: '#18181b', height: 180, type: 'clouds' },
      { x: 0, speedFactor: 0.3, color: '#27272a', height: 100, type: 'mountains' },
      { x: 0, speedFactor: 0.6, color: '#3f3f46', height: 140, type: 'skyline' },
      { x: 0, speedFactor: 1.0, color: '#ff2a5f', height: 400, type: 'ground-grid' },
    ],
    score: 0,
    multiplier: 1,
    comboStreak: 0,
    speed: 5.5,
    spawnTimer: 0,
    coinSpawnTimer: 0,
    currentAction: 'idle',
    screenShake: 0,
    levelUpBannerTimer: 0,
    level: 1,
  });

  // Track muted state
  useEffect(() => {
    // Sync with initial synth setting
    setIsMuted(!audioSynth.isEnabled());
  }, []);

  // Sync action to state ref
  useEffect(() => {
    stateRef.current.currentAction = currentAction;
  }, [currentAction]);

  // Handle keyboard inputs to allow testing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') return;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        stateRef.current.currentAction = 'jump';
        e.preventDefault();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        stateRef.current.currentAction = 'duck';
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        stateRef.current.currentAction = 'left';
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        stateRef.current.currentAction = 'right';
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') return;

      const keys = ['ArrowUp', 'w', 'W', ' ', 'ArrowDown', 's', 'S', 'ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'];
      if (keys.includes(e.key)) {
        stateRef.current.currentAction = 'idle';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Start the game loop
  useEffect(() => {
    let animId: number;

    const spawnObstacle = () => {
      const types: ObstacleType[] = ['SPIKE', 'MUSHROOM', 'BIRD', 'BARRIER'];
      // Level progression enables more difficult obstacle obstacles
      const availableTypes = types.slice(0, Math.min(stateRef.current.level + 1, 4));
      const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];

      let height = 30;
      let width = 30;
      let y = GROUND_Y - height;

      if (type === 'BIRD') {
        height = 24;
        width = 32;
        // Floating high or medium heights
        y = GROUND_Y - 55 - Math.random() * 50;
      } else if (type === 'BARRIER') {
        height = 48;
        width = 24;
        y = GROUND_Y - height;
      } else if (type === 'MUSHROOM') {
        height = 28;
        width = 28;
        y = GROUND_Y - height;
      }

      const colors = {
        SPIKE: '#ef4444',     // Bright Red
        MUSHROOM: '#c084fc',  // Purple
        BIRD: '#f59e0b',      // Amber Yellow
        BARRIER: '#3b82f6',   // Cyan Blue
      };

      stateRef.current.obstacles.push({
        id: Math.random().toString(),
        x: CANVAS_WIDTH + 50,
        y,
        width,
        height,
        speed: stateRef.current.speed,
        type,
        frame: 0,
        frameTimer: 0,
        color: colors[type],
        scored: false,
      });
    };

    const spawnCoin = () => {
      // Coins appear in beautiful sinuous patterns or rows
      const pattern = Math.random() > 0.5 ? 'single' : 'row';
      const startX = CANVAS_WIDTH + 50;
      const baseHeight = GROUND_Y - 40 - Math.random() * 80;

      if (pattern === 'single') {
        stateRef.current.coins.push({
          id: Math.random().toString(),
          x: startX,
          y: baseHeight,
          size: 10,
          color: '#eab308', // Shiny yellow gold
          collected: false,
          pulseTimer: Math.random() * Math.PI,
          value: 10,
        });
      } else {
        // Spawn 3 coins in a row
        for (let i = 0; i < 3; i++) {
          stateRef.current.coins.push({
            id: Math.random().toString(),
            x: startX + i * 40,
            y: baseHeight - Math.sin(i * 0.5) * 20,
            size: 10,
            color: '#eab308',
            collected: false,
            pulseTimer: Math.random() * Math.PI + i * 0.5,
            value: 10,
          });
        }
      }
    };

    const triggerHitParticles = (x: number, y: number, color = '#ef4444') => {
      for (let i = 0; i < 15; i++) {
        stateRef.current.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 6 - 2,
          color,
          size: Math.random() * 4 + 2,
          life: 0,
          maxLife: 30 + Math.random() * 20,
          gravity: true,
        });
      }
    };

    const triggerSparkle = (x: number, y: number, color = '#fbbf24') => {
      for (let i = 0; i < 8; i++) {
        stateRef.current.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          color,
          size: Math.random() * 3 + 1.5,
          life: 0,
          maxLife: 20 + Math.random() * 15,
          gravity: false,
        });
      }
    };

    const triggerDashDust = (x: number, y: number) => {
      stateRef.current.particles.push({
        x,
        y: y + 42,
        vx: -2 - Math.random() * 2,
        vy: -0.5 - Math.random() * 1,
        color: '#71717a',
        size: Math.random() * 4 + 2,
        life: 0,
        maxLife: 15 + Math.random() * 10,
        gravity: false,
      });
    };

    const runGameLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const current = stateRef.current;

      // Ensure canvas is high-quality pixel rendering
      ctx.imageSmoothingEnabled = false;

      // Screen shaking calculation
      ctx.save();
      if (current.screenShake > 0) {
        const dx = (Math.random() - 0.5) * current.screenShake;
        const dy = (Math.random() - 0.5) * current.screenShake;
        ctx.translate(dx, dy);
        current.screenShake *= 0.9;
        if (current.screenShake < 0.2) current.screenShake = 0;
      }

      // CLEAR CANVAS WITH VAPORWAVE/RETRO DARK GRADE
      ctx.fillStyle = '#09090b'; // solid dark zinc
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 1. UPDATE PARALLAX BACKGROUND LAYERS
      current.layers.forEach((layer) => {
        if (gameState === 'PLAYING') {
          // Scroll layers based on speed and factor
          layer.x -= current.speed * layer.speedFactor;
          if (layer.x <= -CANVAS_WIDTH) {
            layer.x = 0;
          }
        }

        // Draw Layer
        ctx.fillStyle = layer.color;
        if (layer.type === 'clouds') {
          // Draw geometric pixel stars and distant small pixel clouds
          ctx.fillRect(layer.x, 30, 20, 2);
          ctx.fillRect(layer.x + 120, 42, 35, 3);
          ctx.fillRect(layer.x + 350, 25, 15, 2);
          ctx.fillRect(layer.x + 580, 50, 42, 3);
          ctx.fillRect(layer.x + 720, 20, 22, 2);

          ctx.fillRect(layer.x + CANVAS_WIDTH, 30, 20, 2);
          ctx.fillRect(layer.x + CANVAS_WIDTH + 120, 42, 35, 3);
          ctx.fillRect(layer.x + CANVAS_WIDTH + 350, 25, 15, 2);
          ctx.fillRect(layer.x + CANVAS_WIDTH + 580, 50, 42, 3);
          ctx.fillRect(layer.x + CANVAS_WIDTH + 720, 20, 22, 2);

          // Star dots
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(layer.x + 90, 80, 2, 2);
          ctx.fillRect(layer.x + 220, 60, 2, 2);
          ctx.fillRect(layer.x + 460, 110, 2, 2);
          ctx.fillRect(layer.x + 600, 75, 2, 2);
          ctx.fillStyle = layer.color; // restoration
        } else if (layer.type === 'mountains') {
          // Draw neat retro polygon silhouettes
          const drawRange = (offsetX: number) => {
            ctx.beginPath();
            ctx.moveTo(offsetX, GROUND_Y);
            ctx.lineTo(offsetX + 100, GROUND_Y - 100);
            ctx.lineTo(offsetX + 180, GROUND_Y - 60);
            ctx.lineTo(offsetX + 280, GROUND_Y - 140);
            ctx.lineTo(offsetX + 380, GROUND_Y - 40);
            ctx.lineTo(offsetX + 480, GROUND_Y - 110);
            ctx.lineTo(offsetX + 600, GROUND_Y - 50);
            ctx.lineTo(offsetX + 720, GROUND_Y - 120);
            ctx.lineTo(offsetX + 800, GROUND_Y);
            ctx.closePath();
            ctx.fill();
          };
          drawRange(layer.x);
          drawRange(layer.x + CANVAS_WIDTH);
        } else if (layer.type === 'skyline') {
          // Draw retro pixel high-rises/scrapers block outline
          const drawBuildings = (offsetX: number) => {
            const blockW = 50;
            const scraperCoords = [
              { w: 45, h: 110 }, { w: 60, h: 170 }, { w: 35, h: 90 }, { w: 55, h: 150 },
              { w: 70, h: 100 }, { w: 50, h: 190 }, { w: 65, h: 130 }, { w: 40, h: 110 },
              { w: 60, h: 140 }, { w: 50, h: 160 }, { w: 45, h: 120 }, { w: 80, h: 90 }
            ];
            let currentX = offsetX;
            scraperCoords.forEach((scr) => {
              ctx.fillRect(currentX, GROUND_Y - scr.h, scr.w - 4, scr.h);
              // Draw light dots inside buildings
              ctx.fillStyle = '#fef08a'; // yellow windows
              ctx.fillRect(currentX + (scr.w / 3), GROUND_Y - scr.h + 20, 3, 3);
              ctx.fillRect(currentX + (scr.w * 2 / 3), GROUND_Y - scr.h + 35, 3, 3);
              ctx.fillRect(currentX + (scr.w / 3), GROUND_Y - scr.h + 50, 3, 3);
              if (scr.h > 140) {
                ctx.fillRect(currentX + (scr.w * 2 / 3), GROUND_Y - scr.h + 80, 3, 3);
              }
              ctx.fillStyle = layer.color; // restore
              currentX += scr.w;
            });
          };
          drawBuildings(layer.x);
          drawBuildings(layer.x + CANVAS_WIDTH);
        } else if (layer.type === 'ground-grid') {
          // Draw glowing magenta vaporwave ground tile grid line perspective
          ctx.strokeStyle = '#f43f5e'; // glowing red pink
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, GROUND_Y);
          ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
          ctx.stroke();

          // Horizontal horizon striping
          ctx.fillStyle = '#ff2a5f';
          ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 4);
          ctx.fillRect(0, GROUND_Y + 15, CANVAS_WIDTH, 6);
          ctx.fillRect(0, GROUND_Y + 38, CANVAS_WIDTH, 8);
          ctx.fillRect(0, GROUND_Y + 68, CANVAS_WIDTH, 12);

          // Vertical grid lines extending to infinity
          ctx.beginPath();
          for (let i = -100; i <= CANVAS_WIDTH + 100; i += 50) {
            ctx.moveTo(i + (layer.x % 50), GROUND_Y);
            // Angle outwards
            const dx = (i - CANVAS_WIDTH / 2) * 1.5;
            ctx.lineTo(CANVAS_WIDTH / 2 + dx + (layer.x % 50) * 2, CANVAS_HEIGHT);
          }
          ctx.strokeStyle = '#f43f5e33'; // transparent glow
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      // 2. UPDATE/DRAW PLAYER INTUITION ENGINES
      const player = current.player;
      if (gameState === 'PLAYING') {
        // Apply Gravity
        player.vy += 0.8; // Gravity pulling player down
        player.y += player.vy;

        // Ground check
        if (player.y >= GROUND_Y - player.height) {
          player.y = GROUND_Y - player.height;
          player.vy = 0;
          player.isGrounded = true;
          if (player.state === 'JUMPING') {
            player.state = 'RUNNING';
          }
        }

        // Action decision trees (from Teachable Machine gesture input)
        // Check "jump" trigger
        if (current.currentAction === 'jump' && player.isGrounded && !player.isDucking) {
          player.vy = -14.5; // Upward launch!
          player.isGrounded = false;
          player.state = 'JUMPING';
          audioSynth.playJump();
        }

        // Check "duck" trigger
        if (current.currentAction === 'duck') {
          if (!player.isDucking) {
            player.isDucking = true;
            player.height = 26; // Reduce height box substantially to dodge high birds
            player.y = GROUND_Y - player.height;
            if (player.isGrounded) {
              player.state = 'DUCKING';
            }
          }
        } else {
          // restore height
          if (player.isDucking) {
            player.isDucking = false;
            player.height = 48;
            player.y = GROUND_Y - player.height;
            if (player.isGrounded) {
              player.state = 'RUNNING';
            }
          }
        }

        // Left/Right sideways adjustments within limits
        const targetSpeedX = 5;
        if (current.currentAction === 'left') {
          player.vx = -targetSpeedX;
        } else if (current.currentAction === 'right') {
          player.vx = targetSpeedX;
        } else {
          // Dampen velocity to center slightly
          player.vx *= 0.85;
          if (Math.abs(player.vx) < 0.1) player.vx = 0;
        }

        player.x += player.vx;
        // Bound checks
        if (player.x < 30) player.x = 30;
        if (player.x > CANVAS_WIDTH - 150) player.x = CANVAS_WIDTH - 150;

        // Reduce flashing invuls
        if (player.invulnTimer > 0) {
          player.invulnTimer--;
        }

        // Handle animation frame pacing
        player.frameTimer++;
        if (player.frameTimer > 6) {
          player.frame = (player.frame + 1) % 4; // 4 frame runner
          player.frameTimer = 0;
          if (player.isGrounded && !player.isDucking && Math.abs(player.vx) >= 0) {
            triggerDashDust(player.x, player.y);
          }
        }
      }

      // Draw Retro Pixel Player Sprite
      const isInvulnFlashing = player.invulnTimer > 0 && Math.floor(player.invulnTimer / 4) % 2 === 0;
      if (!isInvulnFlashing) {
        ctx.fillStyle = player.state === 'HURT' ? '#ef4444' : '#10b981'; // Cyber-emerald green runner
        
        // Let's draw a nice pixelated retro hero!
        // Body base rect
        ctx.fillRect(player.x, player.y, player.width, player.height);

        // Head/Helmet block
        ctx.fillStyle = '#34d399'; // slightly brighter green head
        const headH = 14;
        const headY = player.isDucking ? player.y - 2 : player.y - 12;
        ctx.fillRect(player.x + 6, headY, 20, 12);
        
        // Helmet Visor (Cyber glowing neon blue!)
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(player.x + 16, headY + 3, 10, 4);

        // Leg animations (retro run movement!)
        ctx.fillStyle = '#065f46'; // darker pants
        if (player.state === 'RUNNING') {
          if (player.frame % 2 === 0) {
            // Legs extended forward/back
            ctx.fillRect(player.x + 2, player.y + player.height, 8, 8);
            ctx.fillRect(player.x + player.width - 10, player.y + player.height, 8, 8);
          } else {
            // Legs centered/crossed
            ctx.fillRect(player.x + 8, player.y + player.height, 8, 8);
            ctx.fillRect(player.x + player.width - 16, player.y + player.height, 8, 8);
          }
        } else if (player.state === 'JUMPING') {
          // Flying style legs
          ctx.fillRect(player.x + 4, player.y + player.height, 8, 6);
          ctx.fillRect(player.x + player.width - 12, player.y + player.height, 8, 4);
        } else if (player.state === 'DUCKING') {
          // Low slides legs
          ctx.fillRect(player.x - 4, player.y + player.height - 4, 8, 4);
          ctx.fillRect(player.x + player.width - 4, player.y + player.height - 4, 8, 4);
        }
      }

      // 3. OBSTACLES MECHANICS & SPINS
      if (gameState === 'PLAYING') {
        current.spawnTimer++;
        // Scale spawning timer according to speed
        const spawnDelay = Math.max(70 - Math.floor(current.speed), 45);
        if (current.spawnTimer > spawnDelay + Math.random() * 40) {
          spawnObstacle();
          current.spawnTimer = 0;
        }

        // Coin spawning mechanism
        current.coinSpawnTimer++;
        if (current.coinSpawnTimer > 90 + Math.random() * 100) {
          spawnCoin();
          current.coinSpawnTimer = 0;
        }
      }

      // Update and Draw Obstacles
      for (let i = current.obstacles.length - 1; i >= 0; i--) {
        const obs = current.obstacles[i];

        if (gameState === 'PLAYING') {
          obs.x -= obs.speed;
        }

        // Draw Obstacle pixelated shapes
        ctx.fillStyle = obs.color;
        if (obs.type === 'SPIKE') {
          // Pixel spike drawing
          ctx.beginPath();
          ctx.moveTo(obs.x, obs.y + obs.height);
          ctx.lineTo(obs.x + obs.width / 2, obs.y);
          ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
          ctx.closePath();
          ctx.fill();

          // Inner reflection line
          ctx.fillStyle = '#fca5a5';
          ctx.fillRect(obs.x + (obs.width / 2) - 1, obs.y + 4, 2, obs.height - 6);
        } else if (obs.type === 'MUSHROOM') {
          // Draw retro toxic mushroom
          ctx.fillRect(obs.x + 6, obs.y + 14, 16, 14); // stem (light gray)
          ctx.fillStyle = obs.color; // purple cap
          ctx.fillRect(obs.x, obs.y, 28, 14);
          // white spots
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(obs.x + 4, obs.y + 4, 4, 4);
          ctx.fillRect(obs.x + 18, obs.y + 3, 4, 4);
          ctx.fillRect(obs.x + 11, obs.y + 8, 4, 4);
        } else if (obs.type === 'BIRD') {
          // Wing flap animation frame calculation
          if (gameState === 'PLAYING') {
            obs.frameTimer++;
            if (obs.frameTimer > 8) {
              obs.frame = (obs.frame + 1) % 2;
              obs.frameTimer = 0;
            }
          }
          // Draw bird wings
          ctx.fillStyle = obs.color;
          ctx.fillRect(obs.x, obs.y + 4, obs.width, 14); // bird body
          ctx.fillStyle = '#ffffff'; // white eye
          ctx.fillRect(obs.x + 22, obs.y + 6, 4, 4);
          ctx.fillStyle = '#f59e0b'; // beak
          ctx.fillRect(obs.x + 28, obs.y + 8, 6, 4);

          ctx.fillStyle = obs.color;
          if (obs.frame === 0) {
            // flap up
            ctx.fillRect(obs.x + 10, obs.y - 12, 8, 12);
          } else {
            // flap down
            ctx.fillRect(obs.x + 10, obs.y + 16, 8, 12);
          }
        } else if (obs.type === 'BARRIER') {
          // Tech tower obstacle
          ctx.fillStyle = '#2563eb';
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.fillStyle = '#60a5fa'; // neon accent details
          ctx.fillRect(obs.x + 4, obs.y + 4, obs.width - 8, 6);
          ctx.fillRect(obs.x + 4, obs.y + 18, obs.width - 8, 6);
          ctx.fillRect(obs.x + 4, obs.y + 32, obs.width - 8, 6);
        }

        // Collision Check
        if (gameState === 'PLAYING') {
          // Narrow down bounding box slightly for better retro fairness feeling
          const pLeft = player.x + 4;
          const pRight = player.x + player.width - 4;
          const pTop = player.y + 2;
          const pBottom = player.y + player.height;

          const oLeft = obs.x + 2;
          const oRight = obs.x + obs.width - 2;
          const oTop = obs.y + 2;
          const oBottom = obs.y + obs.height;

          const collides = pLeft < oRight && pRight > oLeft && pTop < oBottom && pBottom > oTop;

          if (collides && player.invulnTimer === 0) {
            // Trigger damage!
            player.invulnTimer = 90; // 1.5 seconds of invuln
            player.lives--;
            setLives(player.lives);
            setMultiplier(1);
            current.multiplier = 1;
            current.comboStreak = 0;
            current.screenShake = 10;
            audioSynth.playHit();
            triggerHitParticles(player.x + 16, player.y + 20, obs.color);

            if (player.lives <= 0) {
              // Game Over triggered
              setGameState('GAMEOVER');
              audioSynth.playGameOver();
            }
          }

          // Check if dodge scored
          if (!obs.scored && obs.x + obs.width < player.x) {
            obs.scored = true;
            // score depends on type
            const dodgePoints = obs.type === 'BIRD' ? 20 : 10;
            const pointsGained = dodgePoints * current.multiplier;
            current.score += pointsGained;
            setScore(current.score);

            // Dodging increases combo streak slowly
            current.comboStreak++;
            if (current.comboStreak >= 5) {
              current.multiplier = Math.min(current.multiplier + 1, 5);
              setMultiplier(current.multiplier);
              current.comboStreak = 0;
              audioSynth.playBeep();
            }

            // Highscore Check
            if (current.score > highScore) {
              setHighScore(current.score);
              localStorage.setItem('retro_gesture_high_score', current.score.toString());
            }

            // Check milestone Levels (every 150 points increases game level speed!)
            const nextLevel = Math.floor(current.score / 150) + 1;
            if (nextLevel > current.level) {
              current.level = nextLevel;
              setLevel(nextLevel);
              current.speed += 0.8; // increase movement velocity speed
              setSpeedMultiplier(parseFloat((current.speed / 5.5).toFixed(1)));
              current.levelUpBannerTimer = 120; // 2 seconds banner display
              audioSynth.playScoreMilestone();
            }
          }
        }

        // Clean up out of bound obstacles
        if (obs.x < -100) {
          current.obstacles.splice(i, 1);
        }
      }

      // Update and Draw Coins/Gems
      for (let i = current.coins.length - 1; i >= 0; i--) {
        const coin = current.coins[i];

        if (gameState === 'PLAYING') {
          coin.x -= current.speed;
          coin.pulseTimer += 0.1;
        }

        // Shiny bouncing drawing
        if (!coin.collected) {
          ctx.save();
          // pulsating retro spinning
          const spinWidth = Math.abs(Math.sin(coin.pulseTimer)) * coin.size * 2;
          ctx.fillStyle = coin.color;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(coin.x, coin.y, spinWidth / 2, coin.size, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Star reflective sparkle inside coin
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(coin.x - 2, coin.y - 4, 4, 4);
          ctx.restore();

          // Collision Check
          if (gameState === 'PLAYING') {
            const pLeft = player.x;
            const pRight = player.x + player.width;
            const pTop = player.y;
            const pBottom = player.y + player.height;

            const dist = Math.hypot(coin.x - (player.x + player.width / 2), coin.y - (player.y + player.height / 2));
            if (dist < player.width / 2 + coin.size) {
              coin.collected = true;
              audioSynth.playCoin();
              triggerSparkle(coin.x, coin.y);

              // Scored!
              const points = coin.value * current.multiplier;
              current.score += points;
              setScore(current.score);

              // Coin triggers fast high multiplier growth
              current.comboStreak += 1.5;
              if (current.comboStreak >= 5) {
                current.multiplier = Math.min(current.multiplier + 1, 5);
                setMultiplier(current.multiplier);
                current.comboStreak = 0;
              }

              // Highscore Check
              if (current.score > highScore) {
                setHighScore(current.score);
                localStorage.setItem('retro_gesture_high_score', current.score.toString());
              }

              // Check milestone Levels
              const nextLevel = Math.floor(current.score / 150) + 1;
              if (nextLevel > current.level) {
                current.level = nextLevel;
                setLevel(nextLevel);
                current.speed += 0.8;
                setSpeedMultiplier(parseFloat((current.speed / 5.5).toFixed(1)));
                current.levelUpBannerTimer = 120;
                audioSynth.playScoreMilestone();
              }
            }
          }
        }

        // Cleanup coin
        if (coin.x < -100 || coin.collected) {
          current.coins.splice(i, 1);
        }
      }

      // 4. PARTICLES PROPULSION
      for (let i = current.particles.length - 1; i >= 0; i--) {
        const pt = current.particles[i];
        if (gameState === 'PLAYING') {
          pt.life++;
          pt.x += pt.vx;
          if (pt.gravity) {
            pt.vy += 0.2;
          }
          pt.y += pt.vy;
        }

        // Draw particle pixel
        ctx.fillStyle = pt.color;
        const opacity = 1 - (pt.life / pt.maxLife);
        ctx.globalAlpha = Math.max(0, opacity);
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
        ctx.globalAlpha = 1.0; // reset

        if (pt.life >= pt.maxLife) {
          current.particles.splice(i, 1);
        }
      }

      // LEVEL UP NOTI OVERHEAD BANNER
      if (current.levelUpBannerTimer > 0) {
        current.levelUpBannerTimer--;
        ctx.fillStyle = '#eab308';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        // Flashing text animation
        if (Math.floor(current.levelUpBannerTimer / 8) % 2 === 0) {
          ctx.fillText(`⚡ SPEED LEVEL UP TO LVL ${current.level}! ⚡`, CANVAS_WIDTH / 2, 160);
        }
      }

      // Restore save for screen shake
      ctx.restore();

      // IF GESTURE CONTROLS ACTIVE DISPLAY A RETRO FEED WATERMARK TRACK
      if (isWebcamActive) {
        ctx.font = '9px monospace';
        ctx.fillStyle = '#34d399';
        ctx.textAlign = 'right';
        ctx.fillText(`CAM FEED ENABLED [ACTIVE ACTION: ${current.currentAction.toUpperCase()}]`, CANVAS_WIDTH - 20, 25);
      }

      // STATE SPECIFIC SCREEN DRAWS
      if (gameState === 'START') {
        // Overlay screen
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Drawing beautiful logo branding
        ctx.textAlign = 'center';
        ctx.fillStyle = '#34d399'; // Emerald
        ctx.font = 'bold 28px monospace';
        ctx.fillText('⚡ 8-BIT GESTURE RUNNER ⚡', CANVAS_WIDTH / 2, 130);

        ctx.fillStyle = '#a1a1aa';
        ctx.font = '13px monospace';
        ctx.fillText('Inspired by Google Offline Dino • Controlled by your Webcam Gestures!', CANVAS_WIDTH / 2, 170);

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('PRESS [START GAME] TO ENGAGE NEURAL MATRIX', CANVAS_WIDTH / 2, 230);

        // Quick tip info boxes
        ctx.fillStyle = '#27272a';
        ctx.fillRect(CANVAS_WIDTH / 2 - 250, 260, 500, 75);
        ctx.strokeStyle = '#3f3f46';
        ctx.strokeRect(CANVAS_WIDTH / 2 - 250, 260, 500, 75);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('⌨️ KEYBOARD ALTERNATIVE:', CANVAS_WIDTH / 2 - 230, 280);
        ctx.fillStyle = '#d4d4d8';
        ctx.fillText('• Jump: Up Arrow / Spacebar', CANVAS_WIDTH / 2 - 230, 298);
        ctx.fillText('• Duck: Down Arrow', CANVAS_WIDTH / 2 - 230, 316);

        ctx.fillText('• Left: A or Left Arrow', CANVAS_WIDTH / 2 + 50, 298);
        ctx.fillText('• Right: D or Right Arrow', CANVAS_WIDTH / 2 + 50, 316);
      } else if (gameState === 'GAMEOVER') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ef4444'; // Red
        ctx.font = 'bold 36px monospace';
        ctx.fillText('💥 GAME OVER 💥', CANVAS_WIDTH / 2, 140);

        ctx.fillStyle = '#eab308';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(`SCORE ACHIEVED: ${current.score}`, CANVAS_WIDTH / 2, 185);

        if (current.score >= highScore && current.score > 0) {
          ctx.fillStyle = '#f472b6';
          ctx.fillText('🏆 NEW HIGH SCORE RECORD! 🏆', CANVAS_WIDTH / 2, 220);
        } else {
          ctx.fillStyle = '#a1a1aa';
          ctx.font = '13px monospace';
          ctx.fillText(`CURRENT HIGH RECORD: ${highScore}`, CANVAS_WIDTH / 2, 220);
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.fillText('CLICK [TRY AGAIN] OR PRESS SPACEBAR TO RESET SYSTEM', CANVAS_WIDTH / 2, 274);
      }

      animId = requestAnimationFrame(runGameLoop);
    };

    animId = requestAnimationFrame(runGameLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [gameState, highScore, isWebcamActive]);

  // Handle Trigger Start Game Actions reset
  const handleStartGame = () => {
    setGameState('PLAYING');
    audioSynth.playScoreMilestone();
    audioSynth.startMusic();

    // Reset reference variables
    stateRef.current.gameState = 'PLAYING';
    stateRef.current.score = 0;
    stateRef.current.multiplier = 1;
    stateRef.current.comboStreak = 0;
    stateRef.current.speed = 5.5;
    stateRef.current.spawnTimer = 0;
    stateRef.current.coinSpawnTimer = 0;
    stateRef.current.level = 1;
    stateRef.current.levelUpBannerTimer = 0;
    stateRef.current.obstacles = [];
    stateRef.current.coins = [];
    stateRef.current.particles = [];
    stateRef.current.currentAction = 'idle';

    // Reset player position
    stateRef.current.player = {
      x: 100,
      y: GROUND_Y - 50,
      width: 32,
      height: 48,
      vx: 0,
      vy: 0,
      isGrounded: true,
      isDucking: false,
      state: 'RUNNING',
      frame: 0,
      frameTimer: 0,
      invulnTimer: 0,
      lives: 3,
    };

    setScore(0);
    setLives(3);
    setLevel(1);
    setMultiplier(1);
    setSpeedMultiplier(1.0);
  };

  const handleToggleMute = () => {
    const isMutedNow = !audioSynth.toggleMute();
    setIsMuted(isMutedNow);
    if (!isMutedNow && gameState === 'PLAYING') {
      audioSynth.startMusic();
    } else {
      audioSynth.stopMusic();
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col w-full bg-[#0a0a0c] border border-slate-800 rounded-lg overflow-hidden shadow-2xl relative">
      {/* HUD STATS BAR */}
      <div className="bg-[#141417] border-b border-slate-800 p-3 text-slate-300 flex items-center justify-between font-mono text-xs select-none">
        
        {/* LIVES COUNTER CHIP */}
        <div className="flex items-center space-x-1.5 bg-[#0a0a0c] px-2.5 py-1 rounded border border-slate-800/80 shrink-0">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">HEALTH:</span>
          <div className="flex space-x-1">
            {[1, 2, 3].map((val) => (
              <span
                key={val}
                className={`w-3.5 h-3.5 flex items-center justify-center font-bold text-[9px] rounded border ${
                  lives >= val
                    ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse'
                    : 'bg-[#0a0a0c] border-slate-800 text-slate-700'
                }`}
              >
                ♥
              </span>
            ))}
          </div>
        </div>

        {/* STATS GROUP CONTAINER */}
        <div className="flex items-center space-x-3 overflow-x-auto scrollbar-none py-0.5 px-2">
          {/* LEVEL */}
          <div className="text-center bg-[#0a0a0c] px-2 py-0.5 border border-slate-800/80 rounded">
            <span className="text-[9px] text-slate-500 block uppercase font-bold">LVL</span>
            <span className="text-amber-400 font-bold">{level}</span>
          </div>

          {/* VELOCITY */}
          <div className="text-center bg-[#0a0a0c] px-2 py-0.5 border border-slate-800/80 rounded">
            <span className="text-[9px] text-slate-500 block uppercase font-bold">SPEED</span>
            <span className="text-cyan-400 font-bold">{speedMultiplier}x</span>
          </div>

          {/* MULTIPLIER COMBO */}
          <div className="text-center bg-[#0a0a0c] px-2 py-0.5 border border-slate-800/80 rounded">
            <span className="text-[9px] text-slate-500 block uppercase font-bold">COMBO</span>
            <span className="text-pink-400 font-bold">x{multiplier}</span>
          </div>

          {/* CURRENT SCORE */}
          <div className="text-center bg-[#0a0a0c] px-3 py-0.5 border border-slate-800/80 rounded min-w-[70px]">
            <span className="text-[9px] text-slate-500 block uppercase font-bold">SCORE</span>
            <span className="text-emerald-400 font-bold tracking-wider">{score}</span>
          </div>

          {/* HIGH SCORE */}
          <div className="text-center bg-[#0a0a0c] px-3 py-0.5 border border-slate-800/80 rounded min-w-[70px]">
            <span className="text-[9px] text-slate-500 block uppercase font-bold">HIGH</span>
            <span className="text-yellow-400 font-bold tracking-wider">{highScore}</span>
          </div>
        </div>

        {/* MUTE CHIP */}
        <button
          id="audio-toggle-btn"
          onClick={handleToggleMute}
          className="text-slate-400 hover:text-emerald-400 p-1 rounded bg-[#0a0a0c] border border-slate-800/80 hover:border-emerald-500 transition cursor-pointer shrink-0"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* CANVAS ELEMENT RENDERS HERE */}
      <div className="relative bg-black h-[400px]">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full block object-contain select-none outline-none bg-black"
        />

        {/* OVERLAY ACTION INSTRUCTIONS FOR START SCENARIO */}
        {gameState === 'START' && (
          <div className="absolute bottom-5 inset-x-0 mx-auto flex items-center justify-center space-x-3 w-[80%]">
            <button
               id="start-running-btn"
               onClick={handleStartGame}
               className="bg-emerald-600 hover:bg-emerald-500 font-bold font-mono text-xs tracking-widest text-white px-8 py-3 rounded-lg border-2 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition active:scale-95 cursor-pointer uppercase flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" /> START GAME RETRO SYSTEM
            </button>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute bottom-12 inset-x-0 mx-auto flex items-center justify-center space-x-3 w-[80%] text-center">
            <button
              id="restart-game-btn"
              onClick={handleStartGame}
              className="bg-red-600 hover:bg-red-500 font-bold font-mono text-xs tracking-widest text-white px-8 py-3 rounded-lg border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] transition active:scale-95 cursor-pointer uppercase flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> TRY AGAIN SYSTEM RESET
            </button>
          </div>
        )}
      </div>

      {/* NEURAL MODEL MONITOR ACCENT */}
      <div className="bg-[#141417] border-t border-slate-800 p-3 flex flex-col md:flex-row items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>GESTRON CONTROL: <strong className={isWebcamActive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}>{isWebcamActive ? 'ACTIVE' : 'STANDBY (USING KEYBOARD/BUTTON FALLBACKS)'}</strong></span>
        </div>
        <div className="flex items-center space-x-2 mt-1 md:mt-0">
          <Award className="w-4 h-4 text-yellow-400 shrink-0" />
          <span>Neural Net Link: <strong className={isModelReady ? 'text-emerald-400' : 'text-slate-500'}>{isModelReady ? 'CALIBRATED' : 'NOT LOADED'}</strong></span>
        </div>
      </div>
    </div>
  );
}
