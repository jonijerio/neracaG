export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type DifficultyLevel = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  id: DifficultyLevel;
  label: 'Easy' | 'Normal' | 'Hard';
  ballFriction: number;
  boardAccel: number;
  boardDamping: number;
  maxAngularVel: number;
}

export const DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    ballFriction: 1.65,
    boardAccel: 4.4,
    boardDamping: 9.0,
    maxAngularVel: 1.35,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    ballFriction: 1.15,
    boardAccel: 5.4,
    boardDamping: 8.2,
    maxAngularVel: 1.65,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    ballFriction: 0.68,
    boardAccel: 7.2,
    boardDamping: 6.8,
    maxAngularVel: 2.15,
  },
};

export type WindPhase = 'calm' | 'telegraph' | 'active';

export type PowerUpType = 'slow_motion' | 'stabilizer';

export interface PowerUpCollectible {
  type: PowerUpType;
  x: number; // position along board (-BOARD_HALF_LEN .. +BOARD_HALF_LEN)
  life: number;
  maxLife: number;
}

export interface ActivePowerUp {
  type: PowerUpType;
  remaining: number;
  duration: number;
}

export const POWERUP_PRESETS: Record<PowerUpType, { id: PowerUpType; label: string; duration: number }> = {
  slow_motion: {
    id: 'slow_motion',
    label: 'Slow Motion',
    duration: 6.0,
  },
  stabilizer: {
    id: 'stabilizer',
    label: 'Stabilizer',
    duration: 6.5,
  },
};

export type MonsterKind = 'monkey' | 'alien' | 'human' | 'robot' | 'slime' | 'titan';

export type MonsterPhase = 'telegraph' | 'active';

export interface MonsterPreset {
  kind: MonsterKind;
  name: string;
  warningText: string;
  color: string;
  duration: number;
  weight: number;
  isGiant?: boolean;
  hitRadius?: number;
}

export const MONSTER_PRESETS: Record<MonsterKind, MonsterPreset> = {
  monkey: {
    kind: 'monkey',
    name: 'Monyet Jahil',
    warningText: 'Monyet melompat di papan!',
    color: '#f59e0b',
    duration: 5.4,
    weight: 1.55,
  },
  alien: {
    kind: 'alien',
    name: 'Alien UFO',
    warningText: 'UFO mengincar bola dengan sinar traktor!',
    color: '#22d3ee',
    duration: 5.8,
    weight: 0.55,
  },
  human: {
    kind: 'human',
    name: 'Manusia Berat',
    warningText: 'Manusia berat menginjak sisi papan!',
    color: '#fb7185',
    duration: 5.0,
    weight: 2.35,
    hitRadius: 15,
  },
  robot: {
    kind: 'robot',
    name: 'Robot Pegas',
    warningText: 'Robot meluncur & menabrak bola!',
    color: '#a78bfa',
    duration: 5.2,
    weight: 1.25,
    hitRadius: 15,
  },
  slime: {
    kind: 'slime',
    name: 'Slime Lengket',
    warningText: 'Slime membuat papan lengket & berat!',
    color: '#4ade80',
    duration: 6.0,
    weight: 1.15,
  },
  titan: {
    kind: 'titan',
    name: 'Titan Batu',
    warningText: 'Monster raksasa menginjak papan! Hindari benturan kerasnya!',
    color: '#f97316',
    duration: 6.2,
    weight: 3.1,
    isGiant: true,
    hitRadius: 28,
  },
};

export interface MonsterEntity {
  id: number;
  kind: MonsterKind;
  phase: MonsterPhase;
  x: number;
  vx: number;
  dir: -1 | 1;
  timer: number;
  maxTimer: number;
  hopPhase: number;
  hopHeight: number;
  hitCooldown: number;
}

export interface SimEvent {
  type:
    | 'target_complete'
    | 'target_enter'
    | 'wind_telegraph'
    | 'wind_gust'
    | 'edge_danger'
    | 'edge_hit'
    | 'hard_bounce'
    | 'powerup_spawned'
    | 'powerup_collected'
    | 'monster_telegraph'
    | 'monster_spawn'
    | 'monster_hit'
    | 'monster_leave'
    | 'shield_save'
    | 'ball_fall_start'
    | 'game_over';
  x?: number;
  combo?: number;
  points?: number;
  dir?: -1 | 1;
  intensity?: number;
  powerUpType?: PowerUpType;
  monsterKind?: MonsterKind;
}

export interface PhysicsState {
  difficulty: DifficultyLevel;

  // Board state
  boardAngle: number; // radians, positive = right side down
  boardAngularVel: number; // rad/s

  // Ball state along the board
  ballX: number; // logical units from board center (-BOARD_HALF_LEN .. +BOARD_HALF_LEN)
  ballVel: number; // logical units/s along board
  ballSpin: number; // radians for rolling markings

  // Falling state (when ball leaves edge)
  isFalling: boolean;
  fallTimer: number;
  fallWorldX: number; // relative to fulcrum center
  fallWorldY: number;
  fallVx: number;
  fallVy: number;

  // Game progress & scoring
  elapsedTime: number;
  score: number;
  scoreFraction: number;
  combo: number;
  comboDecayTimer: number;
  targetsCleared: number;
  level: number;
  isGameOver: boolean;

  // Target zone on board
  targetX: number;
  targetHalfWidth: number;
  targetProgress: number; // 0..1
  targetArmingTimer: number; // >0 means telegraphing before active
  inTargetZone: boolean;

  // Wind disturbance (multi-knob difficulty ramp)
  windPhase: WindPhase;
  windTimer: number;
  windDir: -1 | 1;
  windStrength: number; // current effective acceleration units/s^2
  windPeakStrength: number;

  // Danger & impact feedback
  edgeDanger: number; // 0..1 proximity to board edge
  nearEdgeWasActive: boolean;
  edgeHitCooldown: number;

  // Power-ups
  powerUp: PowerUpCollectible | null;
  powerUpSpawnTimer: number;
  activePowerUp: ActivePowerUp | null;

  // Balance-disturbing monsters
  monsters: MonsterEntity[];
  monsterSpawnTimer: number;
  nextMonsterId: number;

  // Shop modifiers active for run
  targetChargeMultiplier: number;
  edgeShieldsRemaining: number;

  // Deterministic PRNG seed
  rngState: number;
}

export interface MissionHudBanner {
  title: string;
  bonusPoints: number;
  rewardName?: string;
}

export interface ActiveMonsterHud {
  kind: MonsterKind;
  phase: MonsterPhase;
  x: number;
}

export interface HudSnapshot {
  difficulty: DifficultyLevel;
  score: number;
  bestScore: number;
  elapsedSeconds: number;
  combo: number;
  targetsCleared: number;
  level: number;
  angleDegrees: number;
  windPhase: WindPhase;
  windDir: -1 | 1;
  edgeDanger: number;
  activePowerUp: ActivePowerUp | null;
  activeMonster: ActiveMonsterHud | null;
  missionBanner: MissionHudBanner | null;
  runCoins: number;
  totalCoins: number;
  edgeShields: number;
  tiltDir?: -1 | 0 | 1;
}

export interface EndRunSnapshot {
  difficulty: DifficultyLevel;
  score: number;
  bestScore: number;
  elapsedSeconds: number;
  targetsCleared: number;
  maxCombo: number;
  level: number;
  isNewBest: boolean;
  missionsCompletedCount: number;
  missionBonusPoints: number;
  unlockedRewardNames: string[];
  coinsEarned: number;
  totalCoins: number;
}

export const PHYSICS_CONSTANTS = {
  BOARD_HALF_LEN: 260,
  BOARD_THICKNESS: 20,
  BALL_RADIUS: 18,
  FALL_MARGIN: 8,
  MAX_ANGLE_RAD: (26 * Math.PI) / 180,
  GRAVITY: 860,
  BALL_FRICTION: 1.15,
  BOARD_ACCEL: 5.4,
  BOARD_DAMPING: 8.2,
  MAX_ANGULAR_VEL: 1.65,
  FALL_DURATION: 0.55,
  TARGET_HOLD_TIME: 1.25,
  TARGET_ARM_TIME: 0.65,
  WIND_GRACE_TIME: 7.0,
  WIND_TELEGRAPH_TIME: 1.15,
  WIND_ACTIVE_TIME: 2.35,
  MONSTER_GRACE_TIME: 5.5,
  MONSTER_TELEGRAPH_TIME: 1.05,
} as const;
