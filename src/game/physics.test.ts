import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MONSTER_KINDS,
  ballBoardToWorld,
  createInitialPhysicsState,
  getFallThreshold,
  getTargetArmTime,
  getTargetHoldTime,
  getTargetPointValue,
  spawnMonster,
  stepPhysics,
} from './physics';
import {
  createDailyMissionSaveState,
  evaluateDailyMissions,
  normalizeMissionStateForDate,
  selectDailyMissionIds,
  toggleSpecialReward,
} from './missions';
import { computeAtmosphere, levelToAtmosphereProgress } from './atmosphere';
import { BalanceRenderer } from './renderer';
import {
  STARTER_COINS,
  awardCoins,
  buyConsumable,
  buySkin,
  buyUpgrade,
  calculateTargetVictoryCoins,
  consumeConsumable,
  createInitialShopState,
  getTargetChargeMultiplier,
  isSkinUnlocked,
} from './shop';
import { SKIN_ORDER, SKIN_PRESETS, getSkinConfig } from './skins';
import { MONSTER_PRESETS, PHYSICS_CONSTANTS } from './types';

test('ball survives first 5 seconds cleanly without any player input', () => {
  const state = createInitialPhysicsState(12345);
  for (let i = 0; i < 60 * 5; i++) {
    stepPhysics(state, 1 / 60, 0);
  }
  assert.equal(state.isFalling, false);
  assert.equal(state.isGameOver, false);
  assert.equal(Math.abs(state.ballX) < 1, true);
});

test('tilting right increases board angle and rolls ball to the right', () => {
  const state = createInitialPhysicsState(12345);
  for (let i = 0; i < 45; i++) {
    stepPhysics(state, 1 / 60, 1);
  }
  assert.equal(state.boardAngle > 0.1, true);
  assert.equal(state.ballVel > 0, true);
  assert.equal(state.ballX > 10, true);
});

test('tilting left decreases board angle and rolls ball to the left', () => {
  const state = createInitialPhysicsState(12345);
  for (let i = 0; i < 45; i++) {
    stepPhysics(state, 1 / 60, -1);
  }
  assert.equal(state.boardAngle < -0.1, true);
  assert.equal(state.ballVel < 0, true);
  assert.equal(state.ballX < -10, true);
});

test('board angle stays strictly clamped within MAX_ANGLE_RAD', () => {
  const state = createInitialPhysicsState(12345);
  for (let i = 0; i < 180; i++) {
    stepPhysics(state, 1 / 60, 1);
  }
  assert.equal(state.boardAngle <= PHYSICS_CONSTANTS.MAX_ANGLE_RAD + 1e-6, true);

  for (let i = 0; i < 360; i++) {
    stepPhysics(state, 1 / 60, -1);
  }
  assert.equal(state.boardAngle >= -PHYSICS_CONSTANTS.MAX_ANGLE_RAD - 1e-6, true);
});

test('ball falling past edge triggers falling beat then game over', () => {
  const state = createInitialPhysicsState(12345);
  let sawFallStart = false;
  let sawGameOver = false;

  // Hold full right tilt until ball rolls off and completes fall animation
  for (let i = 0; i < 60 * 5; i++) {
    const events = stepPhysics(state, 1 / 60, 1);
    for (const ev of events) {
      if (ev.type === 'ball_fall_start') sawFallStart = true;
      if (ev.type === 'game_over') sawGameOver = true;
    }
    if (state.isGameOver) break;
  }

  assert.equal(sawFallStart, true);
  assert.equal(sawGameOver, true);
  assert.equal(state.isGameOver, true);
  assert.equal(Math.abs(state.ballX) > getFallThreshold(), true);
});

test('holding ball inside center target zone completes target and awards combo points', () => {
  const state = createInitialPhysicsState(12345);
  let completedEvent = false;
  let awardedPoints = 0;

  for (let i = 0; i < 60 * 3; i++) {
    const events = stepPhysics(state, 1 / 60, 0);
    for (const ev of events) {
      if (ev.type === 'target_complete') {
        completedEvent = true;
        awardedPoints = ev.points ?? 0;
      }
    }
    if (completedEvent) break;
  }

  assert.equal(completedEvent, true);
  assert.equal(state.targetsCleared >= 1, true);
  assert.equal(awardedPoints, 100);
  assert.equal(state.combo, 2);
});

test('ballBoardToWorld maps center of level board directly above fulcrum', () => {
  const pos = ballBoardToWorld(0, 0);
  assert.equal(Math.round(pos.x), 0);
  assert.equal(
    Math.round(pos.y),
    -(PHYSICS_CONSTANTS.BOARD_THICKNESS * 0.5 + PHYSICS_CONSTANTS.BALL_RADIUS)
  );
});

test('difficulty adjusts ball friction and board responsiveness', () => {
  const easy = createInitialPhysicsState(12345, 'easy');
  const normal = createInitialPhysicsState(12345, 'normal');
  const hard = createInitialPhysicsState(12345, 'hard');

  // 1. Given identical initial ball velocity on a flat board, Easy damps velocity faster (higher friction) than Normal, and Hard damps slowest
  easy.ballVel = 100;
  normal.ballVel = 100;
  hard.ballVel = 100;
  for (let i = 0; i < 30; i++) {
    stepPhysics(easy, 1 / 60, 0);
    stepPhysics(normal, 1 / 60, 0);
    stepPhysics(hard, 1 / 60, 0);
  }
  assert.equal(easy.ballVel < normal.ballVel, true);
  assert.equal(normal.ballVel < hard.ballVel, true);

  // 2. Given identical tilt input, Hard tilts the board faster (more responsive) than Normal, and Normal faster than Easy
  const easyTilt = createInitialPhysicsState(12345, 'easy');
  const normalTilt = createInitialPhysicsState(12345, 'normal');
  const hardTilt = createInitialPhysicsState(12345, 'hard');
  for (let i = 0; i < 20; i++) {
    stepPhysics(easyTilt, 1 / 60, 1);
    stepPhysics(normalTilt, 1 / 60, 1);
    stepPhysics(hardTilt, 1 / 60, 1);
  }
  assert.equal(easyTilt.boardAngle < normalTilt.boardAngle, true);
  assert.equal(normalTilt.boardAngle < hardTilt.boardAngle, true);
});

test('emits edge_hit when ball strikes end-cap lip at speed and hard_bounce on hard board limit slam', () => {
  const state = createInitialPhysicsState(12345, 'hard');
  let sawEdgeHit = false;
  let sawHardBounce = false;

  for (let i = 0; i < 60 * 4; i++) {
    const events = stepPhysics(state, 1 / 60, 1);
    for (const ev of events) {
      if (ev.type === 'edge_hit') sawEdgeHit = true;
      if (ev.type === 'hard_bounce') sawHardBounce = true;
    }
    if (state.isGameOver) break;
  }

  assert.equal(sawEdgeHit, true);
  assert.equal(sawHardBounce, true);
});

test('BalanceRenderer impact shake activates on hit and decays smoothly to zero', () => {
  const renderer = new BalanceRenderer();
  assert.equal(renderer.getTrauma(), 0);
  assert.deepEqual(renderer.getShakeOffsets(), { x: 0, y: 0, angle: 0 });

  renderer.triggerImpactShake(0.8, 1, 0.5);
  assert.equal(renderer.getTrauma() > 0.5, true);
  assert.equal(renderer.hasActiveEffects(), true);

  renderer.tickVisuals(0.016);
  const activeOffset = renderer.getShakeOffsets();
  assert.equal(Math.abs(activeOffset.x) > 0.5 || Math.abs(activeOffset.y) > 0.5, true);

  // After ~1.5 seconds of ticks, shake decays back to zero
  for (let i = 0; i < 90; i++) {
    renderer.tickVisuals(1 / 60);
  }
  assert.equal(renderer.getTrauma(), 0);
  assert.deepEqual(renderer.getShakeOffsets(), { x: 0, y: 0, angle: 0 });
});

test('BalanceRenderer motion trail records points when moving fast and fades them out', () => {
  const renderer = new BalanceRenderer();
  assert.equal(renderer.getActiveTrailCount(), 0);

  // Slow speed should not record trail points
  renderer.recordTrailPoint(0, -28, 10);
  assert.equal(renderer.getActiveTrailCount(), 0);

  // Fast movement across spaced positions records trail nodes
  renderer.recordTrailPoint(0, -28, 160);
  renderer.recordTrailPoint(10, -28, 180);
  renderer.recordTrailPoint(22, -28, 200);
  assert.equal(renderer.getActiveTrailCount(), 3);
  assert.equal(renderer.hasActiveEffects(), true);

  // After ~0.6s, trail nodes expire cleanly
  for (let i = 0; i < 40; i++) {
    renderer.tickVisuals(1 / 60);
  }
  assert.equal(renderer.getActiveTrailCount(), 0);
});

test('random power-ups spawn on the board and Slow Motion / Stabilizer apply their effects on pickup', () => {
  const state = createInitialPhysicsState(12345, 'normal');
  let spawned = false;
  for (let i = 0; i < 60 * 5; i++) {
    const events = stepPhysics(state, 1 / 60, 0);
    if (events.some((e) => e.type === 'powerup_spawned')) {
      spawned = true;
      break;
    }
  }
  assert.equal(spawned, true);
  assert.notEqual(state.powerUp, null);

  // Test Slow Motion pickup halves excess ball velocity and sets activePowerUp
  state.powerUp = { type: 'slow_motion', x: 40, life: 8, maxLife: 9.5 };
  state.ballX = 38;
  state.ballVel = 200;
  const slowEvents = stepPhysics(state, 1 / 60, 0);
  assert.equal(slowEvents.some((e) => e.type === 'powerup_collected' && e.powerUpType === 'slow_motion'), true);
  assert.equal(state.activePowerUp?.type, 'slow_motion');
  assert.equal(state.ballVel < 120, true);

  // Test Stabilizer reduces board tilt sensitivity vs normal baseline
  const baseline = createInitialPhysicsState(12345, 'normal');
  const stabilized = createInitialPhysicsState(12345, 'normal');
  stabilized.activePowerUp = { type: 'stabilizer', remaining: 6.5, duration: 6.5 };
  for (let i = 0; i < 20; i++) {
    stepPhysics(baseline, 1 / 60, 1);
    stepPhysics(stabilized, 1 / 60, 1);
  }
  assert.equal(stabilized.boardAngle < baseline.boardAngle, true);
});

test('target spawn rate and point value scale dynamically with level progression', () => {
  // Arming delay & hold time decrease (faster spawn/cycle rate) as level increases
  assert.equal(getTargetArmTime(4) < getTargetArmTime(1), true);
  assert.equal(getTargetHoldTime(4) < getTargetHoldTime(1), true);
  assert.equal(getTargetArmTime(50) >= 0.22, true);
  assert.equal(getTargetHoldTime(50) >= 0.75, true);

  // Target point value scales cleanly with level and combo
  assert.equal(getTargetPointValue(1, 1), 100);
  assert.equal(getTargetPointValue(3, 1), 150);
  assert.equal(getTargetPointValue(3, 2), 300);

  // End-to-end simulation check: completing a target at higher elapsed time (level 4) awards higher points & shorter arming delay
  const lvl4 = createInitialPhysicsState(12345, 'normal');
  lvl4.elapsedTime = 46; // level 4
  lvl4.targetX = 0;
  let awarded = 0;
  for (let i = 0; i < 60 * 2; i++) {
    const events = stepPhysics(lvl4, 1 / 60, 0);
    const done = events.find((e) => e.type === 'target_complete');
    if (done) {
      awarded = done.points ?? 0;
      break;
    }
  }
  assert.equal(awarded > 100, true);
  assert.equal(lvl4.targetArmingTimer < PHYSICS_CONSTANTS.TARGET_ARM_TIME, true);
});

test('all 15 neraca and ball skins exist with full ambient particle and shockwave effects', () => {
  assert.equal(SKIN_ORDER.length, 15);
  assert.equal(new Set(SKIN_ORDER).size, 15);

  const renderer = new BalanceRenderer('classic');
  for (const id of SKIN_ORDER) {
    const cfg = getSkinConfig(id);
    assert.equal(SKIN_PRESETS[id].id, id);
    assert.equal(cfg.name.length > 0, true);
    assert.equal(cfg.effectTag.length > 0, true);
    assert.equal(cfg.fx.particleColors.length, 3);

    renderer.setSkin(id);
    assert.equal(renderer.getSkinId(), id);

    // Emits skin ambient particles cleanly when ball moves
    for (let i = 0; i < 10; i++) {
      renderer.emitAmbientForBall(12, -28, 180, 1 / 30);
    }
    assert.equal(renderer.getActiveAmbientCount() > 0, true);
  }

  renderer.spawnShockwave(0, -28);
  assert.equal(renderer.getActiveShockwaveCount(), 1);
  assert.equal(renderer.hasActiveEffects(), true);

  for (let i = 0; i < 80; i++) {
    renderer.tickVisuals(1 / 60);
  }
  assert.equal(renderer.getActiveAmbientCount(), 0);
  assert.equal(renderer.getActiveShockwaveCount(), 0);
});

test('daily mission system picks 3 challenges deterministically, awards bonus points & rewards, and resets daily on new date', () => {
  const day1 = '2026-11-19';
  const day2 = '2026-11-20';
  const picksA = selectDailyMissionIds(day1);
  const picksB = selectDailyMissionIds(day1);
  assert.equal(picksA.length, 3);
  assert.equal(new Set(picksA).size, 3);
  assert.deepEqual(picksA, picksB);

  // Explicit state containing flagship challenges
  const saveState = {
    ...createDailyMissionSaveState(day1),
    missionIds: ['clear_10_targets', 'level_5_no_powerup', 'combo_5'] as const,
  };
  const mutableSave = { ...saveState, missionIds: [...saveState.missionIds] };

  // Reaching level 5 WITH a power-up used should NOT complete level_5_no_powerup
  const withPowerUp = evaluateDailyMissions(mutableSave, {
    targetsCleared: 9,
    level: 5,
    powerUpsUsed: 1,
    maxCombo: 4,
    elapsedSeconds: 30,
    score: 900,
    difficulty: 'normal',
  });
  assert.equal(withPowerUp.newlyCompleted.length, 0);
  const noPowerUpProgress = withPowerUp.progressList.find(
    (p) => p.definition.id === 'level_5_no_powerup'
  );
  assert.equal(noPowerUpProgress?.failedForRun, true);

  // Reaching 10 targets and level 5 with 0 power-ups completes both & unlocks their special rewards
  const successRun = evaluateDailyMissions(mutableSave, {
    targetsCleared: 10,
    level: 5,
    powerUpsUsed: 0,
    maxCombo: 5,
    elapsedSeconds: 50,
    score: 1400,
    difficulty: 'normal',
  });
  assert.equal(successRun.newlyCompleted.length, 3);
  assert.equal(successRun.nextState.completedIds.length, 3);
  assert.equal(successRun.nextState.unlockedRewards.includes('aura_juara'), true);
  assert.equal(successRun.nextState.unlockedRewards.includes('supernova_fx'), true);
  assert.equal(successRun.nextState.unlockedRewards.includes('master_badge'), true);
  assert.equal(successRun.nextState.activeRewards.includes('aura_juara'), true);

  // Toggling an unlocked special reward turns it off and back on
  const toggledOff = toggleSpecialReward(successRun.nextState, 'aura_juara');
  assert.equal(toggledOff.activeRewards.includes('aura_juara'), false);
  const toggledOn = toggleSpecialReward(toggledOff, 'aura_juara');
  assert.equal(toggledOn.activeRewards.includes('aura_juara'), true);

  // Date rollover clears daily completedIds but preserves unlocked rewards and all-time count
  const rolledOver = normalizeMissionStateForDate(toggledOn, day2);
  assert.equal(rolledOver.dateKey, day2);
  assert.equal(rolledOver.completedIds.length, 0);
  assert.equal(rolledOver.totalCompletedAllTime, 3);
  assert.equal(rolledOver.unlockedRewards.includes('aura_juara'), true);
});

test('5 balance-disturbing monsters spawn after grace period and disturb board & ball physics distinctly', () => {
  assert.equal(MONSTER_KINDS.length, 5);
  for (const k of MONSTER_KINDS) {
    assert.equal(MONSTER_PRESETS[k].name.length > 0, true);
  }

  // 1. Title showcase (targetAngleOverride provided) suppresses monster spawning
  const showcase = createInitialPhysicsState(12345);
  showcase.monsterSpawnTimer = 0.05;
  for (let i = 0; i < 30; i++) {
    stepPhysics(showcase, 1 / 60, 0, 0.02);
  }
  assert.equal(showcase.monsters.length, 0);

  // 2. Natural gameplay spawns a monster after MONSTER_GRACE_TIME and transitions telegraph -> active
  const autoSpawn = createInitialPhysicsState(12345);
  let sawTelegraph = false;
  let sawSpawn = false;
  for (let i = 0; i < 60 * 8; i++) {
    const events = stepPhysics(autoSpawn, 1 / 60, 0);
    if (events.some((e) => e.type === 'monster_telegraph')) sawTelegraph = true;
    if (events.some((e) => e.type === 'monster_spawn')) {
      sawSpawn = true;
      break;
    }
  }
  assert.equal(sawTelegraph, true);
  assert.equal(sawSpawn, true);

  // 3. Heavy Human & Monkey weight torque tilts the board down toward the monster's side
  const heavyState = createInitialPhysicsState(12345);
  heavyState.windTimer = 99;
  const human = spawnMonster(heavyState, 'human', 175);
  human.phase = 'active';
  human.timer = human.maxTimer;
  for (let i = 0; i < 40; i++) {
    stepPhysics(heavyState, 1 / 60, 0);
  }
  assert.equal(heavyState.boardAngle > 0.06, true);

  const monkeyState = createInitialPhysicsState(12345);
  monkeyState.windTimer = 99;
  const monkey = spawnMonster(monkeyState, 'monkey', -150);
  monkey.phase = 'active';
  monkey.timer = monkey.maxTimer;
  for (let i = 0; i < 35; i++) {
    stepPhysics(monkeyState, 1 / 60, 0);
  }
  assert.equal(monkeyState.boardAngle < -0.02, true);

  // 4. Alien UFO tractor beam pulls stationary ball toward the beam x
  const alienState = createInitialPhysicsState(12345);
  alienState.windTimer = 99;
  const alien = spawnMonster(alienState, 'alien', 65);
  alien.phase = 'active';
  alien.timer = alien.maxTimer;
  alien.vx = 0;
  for (let i = 0; i < 30; i++) {
    stepPhysics(alienState, 1 / 60, 0);
  }
  assert.equal(alienState.ballVel > 15, true);

  // 5. Robot collides with ball and triggers monster_hit impulse
  const robotState = createInitialPhysicsState(12345);
  robotState.windTimer = 99;
  const robot = spawnMonster(robotState, 'robot', -30);
  robot.phase = 'active';
  robot.timer = robot.maxTimer;
  robot.vx = 180;
  let sawRobotHit = false;
  for (let i = 0; i < 40; i++) {
    const events = stepPhysics(robotState, 1 / 60, 0);
    if (events.some((e) => e.type === 'monster_hit' && e.monsterKind === 'robot')) {
      sawRobotHit = true;
      break;
    }
  }
  assert.equal(sawRobotHit, true);

  // 6. Slime increases friction inside its puddle compared to clean board
  const cleanBall = createInitialPhysicsState(12345);
  cleanBall.windTimer = 99;
  cleanBall.ballVel = 150;
  const slimedBall = createInitialPhysicsState(12345);
  slimedBall.windTimer = 99;
  slimedBall.ballVel = 150;
  const slime = spawnMonster(slimedBall, 'slime', 15);
  slime.phase = 'active';
  slime.timer = slime.maxTimer;
  for (let i = 0; i < 15; i++) {
    stepPhysics(cleanBall, 1 / 60, 0);
    stepPhysics(slimedBall, 1 / 60, 0);
  }
  assert.equal(slimedBall.ballVel < cleanBall.ballVel, true);

  // 7. Monster expiry emits monster_leave and awards survival bonus
  const leaveState = createInitialPhysicsState(12345);
  const mLeave = spawnMonster(leaveState, 'slime', 90);
  mLeave.phase = 'active';
  mLeave.timer = 0.05;
  let leftEvent = false;
  for (let i = 0; i < 10; i++) {
    const events = stepPhysics(leaveState, 1 / 60, 0);
    if (events.some((e) => e.type === 'monster_leave' && e.points === 25)) {
      leftEvent = true;
    }
  }
  assert.equal(leftEvent, true);
  assert.equal(leaveState.monsters.length, 0);
});

test('dynamic background atmosphere transitions smoothly from calm sunrise at level 1 to stormy night at high levels', () => {
  assert.equal(levelToAtmosphereProgress(1), 0);
  assert.equal(levelToAtmosphereProgress(8), 1);
  assert.equal(levelToAtmosphereProgress(15), 1);

  const lvl1 = computeAtmosphere(1);
  assert.equal(lvl1.stage, 'sunrise');
  assert.equal(lvl1.sunOpacity > 0.7, true);
  assert.equal(lvl1.rainIntensity, 0);
  assert.equal(lvl1.lightningChance, 0);

  const lvl3 = computeAtmosphere(3);
  assert.equal(lvl3.stage, 'morning');
  assert.equal(lvl3.cloudAlpha > lvl1.cloudAlpha, true);

  const lvl5 = computeAtmosphere(5);
  assert.equal(lvl5.stage, 'dusk');
  assert.equal(lvl5.starAlpha > lvl3.starAlpha, true);

  const lvl8 = computeAtmosphere(8);
  assert.equal(lvl8.stage, 'storm');
  assert.equal(lvl8.sunOpacity, 0);
  assert.equal(lvl8.rainIntensity, 1);
  assert.equal(lvl8.lightningChance > 0.5, true);
  assert.equal(lvl8.cloudAlpha > 0.8, true);

  // Renderer interpolates atmosphere smoothly toward target level and resets to sunrise cleanly
  const renderer = new BalanceRenderer('classic');
  assert.equal(renderer.getAtmosphereState().stage, 'sunrise');
  renderer.setAtmosphereLevel(8);
  for (let i = 0; i < 180; i++) {
    renderer.tickVisuals(1 / 60);
  }
  const settled = renderer.getAtmosphereState();
  assert.equal(settled.stage, 'storm');
  assert.equal(settled.rainIntensity > 0.9, true);

  renderer.resetEffects();
  assert.equal(renderer.getAtmosphereState().stage, 'sunrise');
  assert.equal(renderer.getAtmosphereState().rainIntensity, 0);
});

test('shop system awards victory coins, purchases skins & items/upgrades, and activates edge shield save', () => {
  let shop = createInitialShopState();
  assert.equal(shop.coins, STARTER_COINS);
  assert.equal(isSkinUnlocked(shop, 'classic'), true);
  assert.equal(isSkinUnlocked(shop, 'cyber'), false);

  // Victory coins scale with level, combo, difficulty, and coin_multiplier upgrade
  const baseCoins = calculateTargetVictoryCoins({
    level: 1,
    combo: 1,
    difficulty: 'normal',
    coinMultiplierLevel: 0,
  });
  const boostedCoins = calculateTargetVictoryCoins({
    level: 3,
    combo: 3,
    difficulty: 'hard',
    coinMultiplierLevel: 2,
  });
  assert.equal(baseCoins >= 12, true);
  assert.equal(boostedCoins > baseCoins, true);

  // Cannot buy expensive skin without enough coins
  const failBuy = buySkin(shop, 'prism');
  assert.equal(failBuy.success, false);
  assert.equal(isSkinUnlocked(failBuy.nextState, 'prism'), false);

  // Earn victory coins and purchase cyber skin (220 coins)
  shop = awardCoins(shop, 300);
  const buyCyber = buySkin(shop, 'cyber');
  assert.equal(buyCyber.success, true);
  shop = buyCyber.nextState;
  assert.equal(isSkinUnlocked(shop, 'cyber'), true);
  assert.equal(shop.coins, STARTER_COINS + 300 - 220);

  // Buy consumable (edge_shield 120) and upgrade (target_boost 200)
  shop = awardCoins(shop, 200);
  const buyShield = buyConsumable(shop, 'edge_shield');
  assert.equal(buyShield.success, true);
  shop = buyShield.nextState;
  assert.equal(shop.consumables.edge_shield, 1);

  const buyBoost = buyUpgrade(shop, 'target_boost');
  assert.equal(buyBoost.success, true);
  shop = buyBoost.nextState;
  assert.equal(shop.upgrades.target_boost, 1);
  assert.equal(getTargetChargeMultiplier(shop) > 1, true);

  // Consuming edge_shield decrements stock cleanly
  shop = consumeConsumable(shop, 'edge_shield');
  assert.equal(shop.consumables.edge_shield, 0);

  // Physics edgeShieldsRemaining saves the ball once before falling
  const shieldSim = createInitialPhysicsState(12345, 'normal');
  shieldSim.edgeShieldsRemaining = 1;
  let sawShieldSave = false;
  for (let i = 0; i < 60 * 5; i++) {
    const events = stepPhysics(shieldSim, 1 / 60, 1);
    if (events.some((e) => e.type === 'shield_save')) {
      sawShieldSave = true;
      break;
    }
  }
  assert.equal(sawShieldSave, true);
  assert.equal(shieldSim.edgeShieldsRemaining, 0);
  assert.equal(shieldSim.isFalling, false);
  assert.equal(shieldSim.ballVel < 0, true);
});

test('BalanceRenderer spawns a full-screen confetti explosion with thousands of particles on new high score', () => {
  const renderer = new BalanceRenderer('classic');
  assert.equal(renderer.getActiveParticleCount(), 0);

  renderer.spawnConfettiExplosion(2000, 1280, 720);
  assert.equal(renderer.getActiveParticleCount(), 2000);
  assert.equal(renderer.hasActiveEffects(), true);

  // Additional world-space impact burst uses remaining ring buffer capacity without discarding confetti
  renderer.spawnBurst(0, -28, 18, '#fde047');
  assert.equal(renderer.getActiveParticleCount(), 2018);

  // Confetti decays cleanly to zero after max lifetime
  for (let i = 0; i < 60 * 4; i++) {
    renderer.tickVisuals(1 / 60);
  }
  assert.equal(renderer.getActiveParticleCount(), 0);

  // resetEffects immediately clears active confetti
  renderer.spawnConfettiExplosion(2000, 1280, 720);
  assert.equal(renderer.getActiveParticleCount(), 2000);
  renderer.resetEffects();
  assert.equal(renderer.getActiveParticleCount(), 0);
});

