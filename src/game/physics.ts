import {
  DIFFICULTY_PRESETS,
  DifficultyLevel,
  PHYSICS_CONSTANTS,
  POWERUP_PRESETS,
  PhysicsState,
  PowerUpType,
  SimEvent,
} from './types';

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

function pickNextTargetX(state: PhysicsState): number {
  // Reach expands smoothly as level rises, staying well inside safe edges
  const maxReach = Math.min(C.BOARD_HALF_LEN - 62, 110 + (state.level - 1) * 18);
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

    // 1. Update Board Tilt Angle (responsiveness scaled by difficulty + Stabilizer modifier)
    const effectiveAccel = isStabilizer ? preset.boardAccel * 0.55 : preset.boardAccel;
    const effectiveDamping = isStabilizer ? preset.boardDamping * 1.45 : preset.boardDamping;
    const effectiveMaxAngVel = isStabilizer ? preset.maxAngularVel * 0.62 : preset.maxAngularVel;

    if (targetAngleOverride !== undefined && targetAngleOverride !== null) {
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

    // 3. Ball Rolling Physics along the tilted board (friction scaled by difficulty + Slow Motion modifier)
    const gravityScale = isSlowMotion ? 0.58 : 1.0;
    const effectiveFriction = isSlowMotion ? preset.ballFriction * 2.0 : preset.ballFriction;
    const slopeAccel = C.GRAVITY * gravityScale * Math.sin(state.boardAngle);
    const totalAccel = slopeAccel + state.windStrength * gravityScale;
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
        state.activePowerUp = {
          type: pType,
          remaining: pPreset.duration,
          duration: pPreset.duration,
        };
        if (pType === 'slow_motion') {
          state.ballVel *= 0.45;
        }
        state.score += 50;
        events.push({
          type: 'powerup_collected',
          powerUpType: pType,
          x: state.powerUp.x,
          points: 50,
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
        const nextType: PowerUpType = nextRandom(state) < 0.5 ? 'slow_motion' : 'stabilizer';
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

    // 5. Target Zone & Scoring
    if (state.targetArmingTimer > 0) {
      state.targetArmingTimer = Math.max(0, state.targetArmingTimer - subDt);
      state.inTargetZone = false;
    } else {
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
        state.targetProgress += (subDt * precisionBonus) / holdTime;
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
