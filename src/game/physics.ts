import {
  DIFFICULTY_PRESETS,
  DifficultyLevel,
  MONSTER_PRESETS,
  MonsterEntity,
  MonsterKind,
  PHYSICS_CONSTANTS,
  POWERUP_PRESETS,
  PhysicsState,
  PowerUpType,
  SimEvent,
} from './types';

export const MONSTER_KINDS: readonly MonsterKind[] = [
  'monkey',
  'alien',
  'human',
  'robot',
  'slime',
  'titan',
];

const C = PHYSICS_CONSTANTS;

/** Deterministic LCG PRNG for reproducible target & wind placement */
export function nextRandom(state: PhysicsState): number {
  state.rngState = (state.rngState * 1664525 + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}

export function createInitialPhysicsState(
  seed = 20261119,
  difficulty: DifficultyLevel = 'normal'
): PhysicsState {
  return {
    difficulty,
    boardAngle: 0,
    boardAngularVel: 0,
    ballX: 0,
    ballVel: 0,
    ballSpin: 0,

    isFalling: false,
    fallTimer: 0,
    fallWorldX: 0,
    fallWorldY: 0,
    fallVx: 0,
    fallVy: 0,

    elapsedTime: 0,
    score: 0,
    scoreFraction: 0,
    combo: 1,
    comboDecayTimer: 0,
    targetsCleared: 0,
    level: 1,
    isGameOver: false,

    targetX: 0,
    targetVel: 0,
    targetHalfWidth: 36,
    targetProgress: 0,
    targetArmingTimer: 0,
    inTargetZone: true,

    windPhase: 'calm',
    windTimer: C.WIND_GRACE_TIME,
    windDir: 1,
    windStrength: 0,
    windPeakStrength: 0,

    edgeDanger: 0,
    nearEdgeWasActive: false,
    edgeHitCooldown: 0,

    powerUp: null,
    powerUpSpawnTimer: 4.0,
    activePowerUp: null,

    monsters: [],
    monsterSpawnTimer: C.MONSTER_GRACE_TIME,
    nextMonsterId: 1,

    targetChargeMultiplier: 1,
    edgeShieldsRemaining: 0,

    rngState: seed >>> 0,
  };
}

export function clamp(val: number, min: number, max: number): number {
  return val < min ? min : val > max ? max : val;
}

export function getFallThreshold(): number {
  return C.BOARD_HALF_LEN + C.FALL_MARGIN;
}

/**
 * Compute board-space to world-space coordinates for the ball resting on top of the board.
 * Fulcrum pivot is at (0, 0), +X right, +Y down.
 */
export function ballBoardToWorld(boardAngle: number, ballX: number): { x: number; y: number } {
  const offsetNormal = -(C.BOARD_THICKNESS * 0.5 + C.BALL_RADIUS);
  const cos = Math.cos(boardAngle);
  const sin = Math.sin(boardAngle);
  return {
    x: ballX * cos - offsetNormal * sin,
    y: ballX * sin + offsetNormal * cos,
  };
}

function getTargetMaxReach(level: number): number {
  return Math.min(C.BOARD_HALF_LEN - 62, 110 + Math.max(0, level - 1) * 18);
}

function pickNextTargetX(state: PhysicsState): number {
  // Reach expands smoothly as level rises, staying well inside safe edges
  const maxReach = getTargetMaxReach(state.level);
  const minSeparation = 70;
  let candidate = 0;
  for (let i = 0; i < 6; i++) {
    const r = nextRandom(state) * 2 - 1;
    candidate = r * maxReach;
    if (Math.abs(candidate - state.ballX) >= minSeparation) {
      break;
    }
  }
  return Math.round(candidate);
}

function pickNextTargetVelocity(state: PhysicsState): number {
  if (state.level < 4) return 0;
  const moveChance = Math.min(0.65, 0.28 + (state.level - 4) * 0.08);
  if (nextRandom(state) >= moveChance) return 0;
  const dir = nextRandom(state) < 0.5 ? -1 : 1;
  const speed = 22 + Math.min(28, (state.level - 4) * 5);
  return dir * speed;
}

function pickPowerUpPosition(state: PhysicsState): number {
  const maxReach = C.BOARD_HALF_LEN - 56;
  let candidate = 0;
  for (let i = 0; i < 8; i++) {
    candidate = Math.round((nextRandom(state) * 2 - 1) * maxReach);
    if (Math.abs(candidate - state.ballX) >= 52 && Math.abs(candidate - state.targetX) >= 34) {
      break;
    }
  }
  return candidate;
}

export function getTargetArmTime(level: number): number {
  return Math.max(0.22, C.TARGET_ARM_TIME - Math.max(0, level - 1) * 0.06);
}

export function getTargetHoldTime(level: number): number {
  return Math.max(0.75, C.TARGET_HOLD_TIME - Math.max(0, level - 1) * 0.05);
}

export function getTargetPointValue(level: number, combo: number): number {
  const baseValue = 100 + Math.max(0, level - 1) * 25;
  return baseValue * Math.max(1, combo);
}

function pickMonsterPosition(state: PhysicsState, kind: MonsterKind): number {
  const minAbs = kind === 'human' ? 105 : kind === 'titan' ? 115 : kind === 'robot' ? 170 : 68;
  const maxAbs = kind === 'human' ? 175 : kind === 'robot' ? 215 : kind === 'titan' ? 195 : 205;
  const minBallDist = kind === 'titan' ? 56 : kind === 'human' ? 46 : 34;
  let candidate = 0;
  for (let i = 0; i < 8; i++) {
    const side: -1 | 1 = nextRandom(state) < 0.5 ? -1 : 1;
    const dist = minAbs + nextRandom(state) * (maxAbs - minAbs);
    candidate = Math.round(side * dist);
    const overlapsExisting = state.monsters.some((m) => Math.abs(m.x - candidate) < 58);
    if (!overlapsExisting && Math.abs(candidate - state.ballX) >= minBallDist) {
      break;
    }
  }
  return candidate;
}

export function spawnMonster(
  state: PhysicsState,
  kindOverride?: MonsterKind,
  xOverride?: number
): MonsterEntity {
  const kind =
    kindOverride ??
    MONSTER_KINDS[Math.floor(nextRandom(state) * MONSTER_KINDS.length) % MONSTER_KINDS.length];
  const preset = MONSTER_PRESETS[kind];
  const x =
    xOverride !== undefined
      ? clamp(Math.round(xOverride), -220, 220)
      : pickMonsterPosition(state, kind);
  const dir: -1 | 1 =
    kind === 'robot'
      ? x >= 0
        ? -1
        : 1
      : x >= 0
        ? 1
        : -1;
  const speed = kind === 'robot' ? 125 : kind === 'alien' ? 76 : kind === 'monkey' ? 22 : 0;

  const entity: MonsterEntity = {
    id: state.nextMonsterId++,
    kind,
    phase: 'telegraph',
    x,
    vx: dir * speed,
    dir,
    timer: C.MONSTER_TELEGRAPH_TIME,
    maxTimer: preset.duration,
    hopPhase: 0,
    hopHeight: 0,
    hitCooldown: 0,
  };
  state.monsters.push(entity);
  return entity;
}

/**
 * Advances simulation by clamped frame dt using 4 sub-steps for crisp collision/rolling accuracy.
 * Returns simulation events generated during this step.
 */
export function stepPhysics(
  state: PhysicsState,
  rawDt: number,
  tiltInput: number, // -1 (left/CCW) .. +1 (right/CW)
  targetAngleOverride?: number | null
): SimEvent[] {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  if (dt === 0 || state.isGameOver) {
    return [];
  }

  const events: SimEvent[] = [];
  const subSteps = 4;
  const subDt = dt / subSteps;
  const clampedInput = clamp(tiltInput, -1, 1);
  const preset = DIFFICULTY_PRESETS[state.difficulty] ?? DIFFICULTY_PRESETS.normal;

  for (let step = 0; step < subSteps; step++) {
    if (state.isFalling) {
      state.fallTimer += subDt;
      state.fallVy += C.GRAVITY * 1.25 * subDt;
      state.fallWorldX += state.fallVx * subDt;
      state.fallWorldY += state.fallVy * subDt;
      state.ballSpin += (state.fallVx / C.BALL_RADIUS) * subDt;

      // Board settles slightly toward level once unloaded
      state.boardAngularVel *= Math.exp(-3.5 * subDt);
      state.boardAngle += state.boardAngularVel * subDt;

      if (state.fallTimer >= C.FALL_DURATION && !state.isGameOver) {
        state.isGameOver = true;
        events.push({ type: 'game_over' });
      }
      continue;
    }

    state.elapsedTime += subDt;
    state.level = 1 + Math.floor(state.elapsedTime / 15) + Math.floor(state.targetsCleared / 3);

    // 0. Update Active Power-Up Timer & Collectible Spawner
    if (state.activePowerUp) {
      state.activePowerUp.remaining -= subDt;
      if (state.activePowerUp.remaining <= 0) {
        state.activePowerUp = null;
      }
    }

    const isSlowMotion = state.activePowerUp?.type === 'slow_motion';
    const isStabilizer = state.activePowerUp?.type === 'stabilizer';
    const isTargetMagnet = state.activePowerUp?.type === 'target_magnet';
    const isTitleShowcase = targetAngleOverride !== undefined && targetAngleOverride !== null;

    // 1. Update Balance-Disturbing Monsters (suppressed during title showcase)
    let monsterTorque = 0;
    let monsterBallAccel = 0;
    let monsterExtraFriction = 0;

    if (!isTitleShowcase) {
      const maxMonsters = state.level >= 5 ? 2 : 1;
      if (state.monsters.length < maxMonsters) {
        state.monsterSpawnTimer -= subDt;
        if (state.monsterSpawnTimer <= 0) {
          const spawned = spawnMonster(state);
          events.push({
            type: 'monster_telegraph',
            monsterKind: spawned.kind,
            x: spawned.x,
            dir: spawned.dir,
          });
          const baseCooldown = Math.max(3.0, 6.2 - (state.level - 1) * 0.4);
          state.monsterSpawnTimer = baseCooldown + nextRandom(state) * 1.6;
        }
      }

      const remainingMonsters: MonsterEntity[] = [];
      for (let i = 0; i < state.monsters.length; i++) {
        const m = state.monsters[i];
        const mPreset = MONSTER_PRESETS[m.kind];
        m.hitCooldown = Math.max(0, m.hitCooldown - subDt);

        if (m.phase === 'telegraph') {
          m.timer -= subDt;
          if (m.timer <= 0) {
            m.phase = 'active';
            m.timer = m.maxTimer;
            events.push({
              type: 'monster_spawn',
              monsterKind: m.kind,
              x: m.x,
              dir: m.dir,
              intensity: m.kind === 'titan' ? 0.92 : m.kind === 'human' ? 0.65 : 0.44,
            });
          }
          remainingMonsters.push(m);
          continue;
        }

        // Active monster behavior & physics disturbance
        const normX = m.x / 200;
        const levelScale = 1 + Math.min(0.45, Math.max(0, state.level - 1) * 0.06);

        if (m.kind === 'monkey') {
          m.hopPhase += subDt * 4.8;
          const wave = Math.sin(m.hopPhase);
          m.hopHeight = Math.max(0, wave * 28);
          m.x += m.vx * subDt;
          if (m.x > 210) {
            m.x = 210;
            m.vx = -Math.abs(m.vx);
            m.dir = -1;
          } else if (m.x < -210) {
            m.x = -210;
            m.vx = Math.abs(m.vx);
            m.dir = 1;
          }
          const stompMultiplier = m.hopHeight < 6 ? 2.45 : 0.65;
          monsterTorque += normX * mPreset.weight * stompMultiplier * levelScale;
        } else if (m.kind === 'alien') {
          m.hopPhase += subDt * 3.4;
          m.x += m.vx * subDt;
          if (m.x > 205) {
            m.x = 205;
            m.vx = -Math.abs(m.vx);
            m.dir = -1;
          } else if (m.x < -205) {
            m.x = -205;
            m.vx = Math.abs(m.vx);
            m.dir = 1;
          }
          // Tractor beam pulls or nudges ball horizontally when beneath UFO cone
          const dxBall = m.x - state.ballX;
          if (Math.abs(dxBall) < 105) {
            const pullDir = Math.abs(dxBall) > 6 ? Math.sign(dxBall) : m.dir;
            monsterBallAccel += pullDir * (82 + Math.min(48, (state.level - 1) * 8));
          }
          monsterTorque += Math.sin(m.hopPhase) * mPreset.weight * 1.15;
        } else if (m.kind === 'human') {
          m.hopPhase += subDt * 2.6;
          // Meaningful weight leverage capped well below player's counter-tilt authority on every difficulty
          const rawHumanTorque = normX * mPreset.weight * 1.82 * levelScale;
          const maxHumanTorque = preset.boardAccel * 0.62;
          monsterTorque += clamp(rawHumanTorque, -maxHumanTorque, maxHumanTorque);
          // Counter-tilting or holding opposite tilt input shakes Manusia Berat off noticeably faster
          const sideSign = Math.sign(m.x) || m.dir;
          const isCounterTilted = state.boardAngle * sideSign < -0.04;
          const isHoldingCounterInput = clampedInput * sideSign < -0.25;
          if (isCounterTilted || isHoldingCounterInput) {
            m.timer -= subDt * (isCounterTilted ? 1.35 : 0.85);
          }
          // Body-check collision: firm rebound inward, gentler deflection near outer cliff so ball isn't unfairly blasted off
          const hitDist = C.BALL_RADIUS + (mPreset.hitRadius ?? 15);
          if (m.hitCooldown <= 0 && Math.abs(state.ballX - m.x) <= hitDist) {
            const pushDir: -1 | 1 = state.ballX >= m.x ? 1 : -1;
            const pushingTowardCliff = pushDir === sideSign && Math.abs(m.x) > 105;
            state.ballX = clamp(
              m.x + pushDir * (hitDist + 1),
              -C.BOARD_HALF_LEN + 18,
              C.BOARD_HALF_LEN - 18
            );
            state.ballVel = pushingTowardCliff
              ? pushDir * Math.min(88, Math.abs(state.ballVel) * 0.35 + 42)
              : pushDir * Math.max(155, Math.abs(state.ballVel) * 0.65 + 110);
            m.hitCooldown = 0.85;
            events.push({
              type: 'monster_hit',
              monsterKind: 'human',
              x: m.x,
              dir: pushDir,
              intensity: pushingTowardCliff ? 0.62 : 0.85,
            });
          }
        } else if (m.kind === 'robot') {
          m.hopPhase += subDt * 8.0;
          m.x += m.vx * subDt;
          if (m.x > 215) {
            m.x = 215;
            m.vx = -Math.abs(m.vx);
            m.dir = -1;
          } else if (m.x < -215) {
            m.x = -215;
            m.vx = Math.abs(m.vx);
            m.dir = 1;
          }
          monsterTorque += normX * mPreset.weight * 1.85 * levelScale;
          if (m.hitCooldown <= 0 && Math.abs(state.ballX - m.x) <= C.BALL_RADIUS + 15) {
            const pushDir: -1 | 1 = state.ballX >= m.x ? 1 : -1;
            state.ballVel += pushDir * 145;
            m.vx = -pushDir * Math.max(105, Math.abs(m.vx));
            m.dir = m.vx >= 0 ? 1 : -1;
            m.hitCooldown = 0.75;
            events.push({
              type: 'monster_hit',
              monsterKind: 'robot',
              x: m.x,
              dir: pushDir,
              intensity: 0.72,
            });
          }
        } else if (m.kind === 'slime') {
          m.hopPhase += subDt * 5.2;
          monsterTorque += normX * mPreset.weight * 1.8 * levelScale;
          if (Math.abs(state.ballX - m.x) <= 40) {
            monsterExtraFriction += 4.2;
          }
        } else if (m.kind === 'titan') {
          m.hopPhase += subDt * 2.1;
          const stompWave = Math.max(0, Math.sin(m.hopPhase));
          m.hopHeight = stompWave > 0.7 ? (stompWave - 0.7) * 28 : 0;
          const stompBias = m.hopHeight < 2 ? 2.45 : 1.75;
          monsterTorque += normX * mPreset.weight * stompBias * levelScale;
          // Counter-tilting strongly shakes off Titan faster
          if (state.boardAngle * Math.sign(m.x) < -0.18) {
            m.timer -= subDt * 0.65;
          }
          // Giant stone obstacle body collision -> massive rebound & full-strength distortion trigger
          const titanHitDist = C.BALL_RADIUS + (mPreset.hitRadius ?? 28);
          if (m.hitCooldown <= 0 && Math.abs(state.ballX - m.x) <= titanHitDist) {
            const pushDir: -1 | 1 = state.ballX >= m.x ? 1 : -1;
            state.ballX = clamp(
              m.x + pushDir * (titanHitDist + 1),
              -C.BOARD_HALF_LEN + 18,
              C.BOARD_HALF_LEN - 18
            );
            state.ballVel = pushDir * Math.max(195, Math.abs(state.ballVel) * 0.75 + 135);
            state.boardAngularVel += -pushDir * 0.42;
            m.hitCooldown = 0.95;
            events.push({
              type: 'monster_hit',
              monsterKind: 'titan',
              x: m.x,
              dir: pushDir,
              intensity: 1.0,
            });
          }
        }

        m.timer -= subDt;
        if (m.timer <= 0) {
          state.score += 25;
          events.push({
            type: 'monster_leave',
            monsterKind: m.kind,
            x: m.x,
            points: 25,
          });
        } else {
          remainingMonsters.push(m);
        }
      }
      state.monsters = remainingMonsters;
    }

    // 1b. Update Board Tilt Angle (responsiveness scaled by difficulty + Stabilizer + monster torque)
    const effectiveAccel = isStabilizer ? preset.boardAccel * 0.55 : preset.boardAccel;
    const effectiveDamping = isStabilizer ? preset.boardDamping * 1.45 : preset.boardDamping;
    const effectiveMaxAngVel = isStabilizer ? preset.maxAngularVel * 0.62 : preset.maxAngularVel;

    if (isTitleShowcase) {
      const clampedTarget = clamp(targetAngleOverride, -C.MAX_ANGLE_RAD, C.MAX_ANGLE_RAD);
      const diff = clampedTarget - state.boardAngle;
      state.boardAngularVel = clamp(diff * 12, -effectiveMaxAngVel * 1.4, effectiveMaxAngVel * 1.4);
      state.boardAngle += state.boardAngularVel * subDt;
    } else {
      if (Math.abs(clampedInput) > 0.01) {
        state.boardAngularVel += clampedInput * effectiveAccel * subDt;
      } else if (isStabilizer) {
        // Gentle leveling assist when no tilt input is held during Stabilizer
        state.boardAngularVel -= state.boardAngle * 1.3 * subDt;
      }
      state.boardAngularVel += monsterTorque * (isStabilizer ? 0.58 : 1.0) * subDt;
      // Exponential angular velocity damping for weighty precision feel
      state.boardAngularVel *= Math.exp(-effectiveDamping * subDt);
      state.boardAngularVel = clamp(state.boardAngularVel, -effectiveMaxAngVel, effectiveMaxAngVel);
      state.boardAngle += state.boardAngularVel * subDt;
    }

    if (state.boardAngle > C.MAX_ANGLE_RAD) {
      state.boardAngle = C.MAX_ANGLE_RAD;
      if (state.boardAngularVel > 0) {
        const impactVel = state.boardAngularVel;
        if (impactVel >= 0.65) {
          state.boardAngularVel = -impactVel * 0.28;
          events.push({
            type: 'hard_bounce',
            dir: 1,
            intensity: clamp(impactVel / preset.maxAngularVel, 0.25, 0.75),
          });
        } else {
          state.boardAngularVel = 0;
        }
      }
    } else if (state.boardAngle < -C.MAX_ANGLE_RAD) {
      state.boardAngle = -C.MAX_ANGLE_RAD;
      if (state.boardAngularVel < 0) {
        const impactVel = Math.abs(state.boardAngularVel);
        if (impactVel >= 0.65) {
          state.boardAngularVel = impactVel * 0.28;
          events.push({
            type: 'hard_bounce',
            dir: -1,
            intensity: clamp(impactVel / preset.maxAngularVel, 0.25, 0.75),
          });
        } else {
          state.boardAngularVel = 0;
        }
      }
    }

    // 2. Update Wind Gust State Machine
    state.windTimer -= subDt;
    if (state.windPhase === 'calm') {
      state.windStrength = 0;
      if (state.windTimer <= 0) {
        state.windPhase = 'telegraph';
        state.windTimer = C.WIND_TELEGRAPH_TIME;
        state.windDir = nextRandom(state) < 0.5 ? -1 : 1;
        state.windPeakStrength = Math.min(115, 42 + (state.level - 1) * 11);
        events.push({ type: 'wind_telegraph', dir: state.windDir });
      }
    } else if (state.windPhase === 'telegraph') {
      state.windStrength = 0;
      if (state.windTimer <= 0) {
        state.windPhase = 'active';
        state.windTimer = C.WIND_ACTIVE_TIME;
        events.push({ type: 'wind_gust', dir: state.windDir });
      }
    } else if (state.windPhase === 'active') {
      // Smooth bell curve gust envelope
      const progress = 1 - Math.max(0, state.windTimer) / C.WIND_ACTIVE_TIME;
      const envelope = Math.sin(progress * Math.PI);
      state.windStrength = state.windDir * state.windPeakStrength * envelope;
      if (state.windTimer <= 0) {
        state.windPhase = 'calm';
        state.windStrength = 0;
        const cooldown = Math.max(2.6, 5.2 - (state.level - 1) * 0.35);
        state.windTimer = cooldown + nextRandom(state) * 1.4;
      }
    }

    // 3. Ball Rolling Physics along the tilted board (friction scaled by difficulty + Slow Motion + Slime + Magnet Target)
    const gravityScale = isSlowMotion ? 0.58 : 1.0;
    const effectiveFriction =
      (isSlowMotion ? preset.ballFriction * 2.0 : preset.ballFriction) +
      (isTargetMagnet ? 0.85 : 0) +
      monsterExtraFriction;
    const magnetAccel = isTargetMagnet
      ? clamp((state.targetX - state.ballX) * 2.2, -145, 145)
      : 0;
    const slopeAccel = C.GRAVITY * gravityScale * Math.sin(state.boardAngle);
    const totalAccel = slopeAccel + (state.windStrength + monsterBallAccel) * gravityScale + magnetAccel;
    state.ballVel += totalAccel * subDt;
    state.ballVel *= Math.exp(-effectiveFriction * subDt);
    state.ballX += state.ballVel * subDt;
    state.ballSpin += (state.ballVel / C.BALL_RADIUS) * subDt;

    // 3b. Power-Up Collectible Spawn & Pickup Check
    if (state.powerUp) {
      state.powerUp.life -= subDt;
      if (Math.abs(state.ballX - state.powerUp.x) <= C.BALL_RADIUS + 14) {
        const pType = state.powerUp.type;
        const pPreset = POWERUP_PRESETS[pType];
        let bonusPoints = 50;
        let repelledCount = 0;

        if (pType === 'monster_repel') {
          repelledCount = state.monsters.length;
          state.monsters = [];
          state.windPhase = 'calm';
          state.windStrength = 0;
          state.windTimer = Math.max(state.windTimer, 3.2);
          bonusPoints += repelledCount * 25;
        } else {
          state.activePowerUp = {
            type: pType,
            remaining: pPreset.duration,
            duration: pPreset.duration,
          };
          if (pType === 'slow_motion') {
            state.ballVel *= 0.45;
          }
        }

        state.score += bonusPoints;
        events.push({
          type: 'powerup_collected',
          powerUpType: pType,
          x: state.powerUp.x,
          points: bonusPoints,
          repelledCount,
        });
        state.powerUp = null;
        state.powerUpSpawnTimer = 6.5 + nextRandom(state) * 3.5;
      } else if (state.powerUp.life <= 0) {
        state.powerUp = null;
        state.powerUpSpawnTimer = 4.5 + nextRandom(state) * 3.0;
      }
    } else {
      state.powerUpSpawnTimer -= subDt;
      if (state.powerUpSpawnTimer <= 0) {
        const roll = nextRandom(state);
        const nextType: PowerUpType =
          state.monsters.length > 0 && roll < 0.34
            ? 'monster_repel'
            : roll < 0.34
              ? 'slow_motion'
              : roll < 0.67
                ? 'stabilizer'
                : roll < 0.9
                  ? 'target_magnet'
                  : 'monster_repel';
        const px = pickPowerUpPosition(state);
        state.powerUp = {
          type: nextType,
          x: px,
          life: 9.5,
          maxLife: 9.5,
        };
        events.push({
          type: 'powerup_spawned',
          powerUpType: nextType,
          x: px,
        });
      }
    }

    // 4. Edge Proximity, Brass End-Cap Lip Hit & Fall-Off Check
    state.edgeHitCooldown = Math.max(0, state.edgeHitCooldown - subDt);
    const fallThreshold = getFallThreshold();
    const dangerStart = C.BOARD_HALF_LEN * 0.72;
    const edgeLipX = C.BOARD_HALF_LEN - 16;
    state.edgeDanger = clamp(
      (Math.abs(state.ballX) - dangerStart) / (fallThreshold - dangerStart),
      0,
      1
    );

    if (state.edgeDanger > 0.45 && !state.nearEdgeWasActive) {
      state.nearEdgeWasActive = true;
      events.push({ type: 'edge_danger', x: state.ballX });
    } else if (state.edgeDanger < 0.25) {
      state.nearEdgeWasActive = false;
    }

    if (
      Math.abs(state.ballX) >= edgeLipX &&
      Math.abs(state.ballX) <= fallThreshold &&
      state.ballX * state.ballVel > 0 &&
      Math.abs(state.ballVel) >= 95 &&
      state.edgeHitCooldown <= 0
    ) {
      state.edgeHitCooldown = 0.24;
      events.push({
        type: 'edge_hit',
        x: state.ballX,
        dir: state.ballX > 0 ? 1 : -1,
        intensity: clamp(Math.abs(state.ballVel) / 290, 0.3, 0.85),
      });
    }

    if (Math.abs(state.ballX) > fallThreshold) {
      if (state.edgeShieldsRemaining > 0) {
        state.edgeShieldsRemaining -= 1;
        const side: -1 | 1 = state.ballX >= 0 ? 1 : -1;
        state.ballX = side * (C.BOARD_HALF_LEN - 26);
        state.ballVel = -side * 125;
        state.boardAngularVel *= 0.2;
        state.edgeDanger = 0.5;
        events.push({
          type: 'shield_save',
          x: state.ballX,
          dir: side,
          intensity: 0.85,
        });
      } else {
        state.isFalling = true;
        state.fallTimer = 0;
        const worldPos = ballBoardToWorld(state.boardAngle, state.ballX);
        const cos = Math.cos(state.boardAngle);
        const sin = Math.sin(state.boardAngle);
        state.fallWorldX = worldPos.x;
        state.fallWorldY = worldPos.y;
        // Convert board velocity to world velocity + outward tip impulse
        const tipImpulse = Math.sign(state.ballX) * 65;
        state.fallVx = (state.ballVel + tipImpulse) * cos;
        state.fallVy = (state.ballVel + tipImpulse) * sin + 35;
        events.push({
          type: 'ball_fall_start',
          x: state.ballX,
          dir: state.ballX > 0 ? 1 : -1,
          intensity: clamp(Math.abs(state.ballVel) / 260, 0.55, 1),
        });
        continue;
      }
    }

    // 5. Target Zone & Scoring (including gentle moving target glide at Level 4+)
    if (state.targetArmingTimer > 0) {
      state.targetArmingTimer = Math.max(0, state.targetArmingTimer - subDt);
      state.inTargetZone = false;
    } else {
      if (state.targetVel !== 0) {
        const maxReach = getTargetMaxReach(state.level);
        state.targetX += state.targetVel * subDt;
        if (state.targetX > maxReach) {
          state.targetX = maxReach;
          state.targetVel = -Math.abs(state.targetVel);
        } else if (state.targetX < -maxReach) {
          state.targetX = -maxReach;
          state.targetVel = Math.abs(state.targetVel);
        }
      }

      const distToTarget = Math.abs(state.ballX - state.targetX);
      const wasIn = state.inTargetZone;
      state.inTargetZone = distToTarget <= state.targetHalfWidth;

      if (state.inTargetZone && !wasIn) {
        events.push({ type: 'target_enter', x: state.targetX });
      }

      if (state.inTargetZone) {
        // Center precision charges faster (up to 1.35x speed) and level tightens hold pacing
        const precisionBonus = 1 + 0.35 * (1 - distToTarget / state.targetHalfWidth);
        const holdTime = getTargetHoldTime(state.level);
        state.targetProgress +=
          (subDt * precisionBonus * Math.max(1, state.targetChargeMultiplier)) / holdTime;
        state.comboDecayTimer = 4.5;

        if (state.targetProgress >= 1) {
          state.targetsCleared += 1;
          const earned = getTargetPointValue(state.level, state.combo);
          state.score += earned;
          events.push({
            type: 'target_complete',
            x: state.targetX,
            combo: state.combo,
            points: earned,
          });
          state.combo = Math.min(8, state.combo + 1);
          state.targetProgress = 0;
          state.targetHalfWidth = Math.max(22, 36 - Math.floor(state.level / 2) * 2);
          state.targetX = pickNextTargetX(state);
          state.targetVel = pickNextTargetVelocity(state);
          state.targetArmingTimer = getTargetArmTime(state.level);
          state.inTargetZone = false;
        }
      } else {
        state.targetProgress = Math.max(0, state.targetProgress - subDt * 0.55);
        if (state.combo > 1) {
          state.comboDecayTimer -= subDt;
          if (state.comboDecayTimer <= 0) {
            state.combo = 1;
          }
        }
      }
    }

    // Steady survival score scales with level (x2 inside target zone)
    const baseSurvivalRate = 12 + Math.max(0, state.level - 1) * 2;
    const rate = state.inTargetZone ? baseSurvivalRate * 2 : baseSurvivalRate;
    state.scoreFraction += rate * subDt;
    if (state.scoreFraction >= 1) {
      const whole = Math.floor(state.scoreFraction);
      state.score += whole;
      state.scoreFraction -= whole;
    }
  }

  return events;
}
