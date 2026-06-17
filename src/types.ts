/**
 * TYPES FOR 8-BIT GESTURE PLATFORMER
 */

export type GameState = 'START' | 'PLAYING' | 'GAMEOVER' | 'PAUSED';

export type PlayerState = 'RUNNING' | 'JUMPING' | 'DUCKING' | 'HURT' | 'DEAD';

export type ObstacleType = 'SPIKE' | 'MUSHROOM' | 'BIRD' | 'BARRIER';

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  isGrounded: boolean;
  isDucking: boolean;
  state: PlayerState;
  frame: number;
  frameTimer: number;
  invulnTimer: number;
  lives: number;
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  type: ObstacleType;
  frame: number;
  frameTimer: number;
  color: string;
  scored: boolean;
}

export interface Coin {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  collected: boolean;
  pulseTimer: number;
  value: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  gravity?: boolean;
}

export interface ParallaxLayer {
  x: number;
  speedFactor: number;
  color: string;
  height: number;
  amplitude?: number;
  frequency?: number;
  type: 'skyline' | 'mountains' | 'clouds' | 'ground-grid';
}

export type GameAction = 'idle' | 'jump' | 'duck' | 'left' | 'right';

export interface ModelClassMap {
  className: string;
  action: GameAction;
  threshold: number;
}

export interface GestureControlStatus {
  activeGesture: GameAction;
  confidences: Record<string, number>;
  modelLoaded: boolean;
  webcamActive: boolean;
  error: string | null;
}
