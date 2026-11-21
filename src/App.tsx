import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { StatusModal } from './components/StatusModal';
import { TitleScreen } from './components/TitleScreen';
import { gameAudio } from './game/audio';
import {
  DailyMissionSaveState,
  SPECIAL_REWARDS,
  SpecialRewardId,
  evaluateDailyMissions,
  readDailyMissionState,
  saveDailyMissionState,
  toggleSpecialReward,
} from './game/missions';
import { computeGyroTiltInput } from './game/input';
import { ballBoardToWorld, createInitialPhysicsState, stepPhysics } from './game/physics';
import { BalanceRenderer } from './game/renderer';
import {
  ShopConsumableId,
  ShopSaveState,
  ShopUpgradeId,
  awardCoins,
  buyConsumable,
  buySkin,
  buyUpgrade,
  calculateTargetVictoryCoins,
  consumeConsumable,
  getTargetChargeMultiplier,
  isSkinUnlocked,
  readShopState,
  saveShopState,
  scaleBonusCoins,
} from './game/shop';
import { SKIN_PRESETS, SkinId } from './game/skins';
import {
  DifficultyLevel,
  EndRunSnapshot,
  GamePhase,
  HudSnapshot,
  MONSTER_PRESETS,
  MissionHudBanner,
  PHYSICS_CONSTANTS,
  POWERUP_PRESETS,
  PhysicsState,
} from './game/types';

const BEST_SCORE_STORAGE_KEY = 'neraca_best_score_v1';
const SKIN_STORAGE_KEY = 'neraca_skin_v1';

function readSavedSkin(): SkinId {
  try {
    const raw = localStorage.getItem(SKIN_STORAGE_KEY);
    if (raw && raw in SKIN_PRESETS) {
      return raw as SkinId;
    }
  } catch {
    // Ignore storage errors
  }
  return 'classic';
}

function saveSelectedSkin(skinId: SkinId): void {
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, skinId);
  } catch {
    // Ignore storage errors
  }
}

function readBestScore(): number {
  try {
    const raw = localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(Math.round(score)));
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

function isAutostartRequested(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

export default function App() {
  const initialPhase: GamePhase = isAutostartRequested() ? 'playing' : 'title';

  const [phase, setPhase] = useState<GamePhase>(initialPhase);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('normal');
  const [shopState, setShopState] = useState<ShopSaveState>(() => readShopState());
  const [selectedSkin, setSelectedSkin] = useState<SkinId>(() => {
    const saved = readSavedSkin();
    const initialShop = readShopState();
    return isSkinUnlocked(initialShop, saved) ? saved : 'classic';
  });
  const [openShopOnTitle, setOpenShopOnTitle] = useState<boolean>(false);
  const [missionState, setMissionState] = useState<DailyMissionSaveState>(() =>
    readDailyMissionState()
  );
  const [muted, setMuted] = useState<boolean>(false);
  const [gyroSupported] = useState<boolean>(
    () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  );
  const [gyroEnabled, setGyroEnabled] = useState<boolean>(false);
  const [bestScore, setBestScore] = useState<number>(() => readBestScore());
  const [endRun, setEndRun] = useState<EndRunSnapshot | null>(null);
  const [hud, setHud] = useState<HudSnapshot>({
    difficulty: 'normal',
    score: 0,
    bestScore: readBestScore(),
    elapsedSeconds: 0,
    combo: 1,
    targetsCleared: 0,
    level: 1,
    angleDegrees: 0,
    windPhase: 'calm',
    windDir: 1,
    edgeDanger: 0,
    activePowerUp: null,
    activeMonster: null,
    missionBanner: null,
    runCoins: 0,
    totalCoins: readShopState().coins,
    edgeShields: 0,
    tiltDir: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<GamePhase>(initialPhase);
  const difficultyRef = useRef<DifficultyLevel>('normal');
  const skinRef = useRef<SkinId>(selectedSkin);
  const shopStateRef = useRef<ShopSaveState>(shopState);
  const missionStateRef = useRef<DailyMissionSaveState>(missionState);
  const bestScoreRef = useRef<number>(bestScore);
  const runStartBestRef = useRef<number>(bestScore);
  const newBestCelebratedRef = useRef<boolean>(false);
  const maxComboRef = useRef<number>(1);
  const powerUpsUsedRef = useRef<number>(0);
  const runCoinsEarnedRef = useRef<number>(0);
  const runMissionsCompletedRef = useRef<number>(0);
  const runMissionBonusRef = useRef<number>(0);
  const runUnlockedRewardsRef = useRef<string[]>([]);
  const missionBannerRef = useRef<MissionHudBanner | null>(null);
  const missionBannerTimerRef = useRef<number>(0);

  const physicsRef = useRef<PhysicsState>(createInitialPhysicsState(20261119, 'normal'));
  const rendererRef = useRef<BalanceRenderer>(new BalanceRenderer(selectedSkin));

  useEffect(() => {
    rendererRef.current.setActiveRewards(missionStateRef.current.activeRewards);
  }, []);

  // Input state refs (cleared on blur / phase transitions)
  const keysHeldRef = useRef<Set<string>>(new Set());
  const buttonTiltRef = useRef<-1 | 0 | 1>(0);
  const canvasDragTiltRef = useRef<number>(0);
  const isCanvasDraggingRef = useRef<boolean>(false);
  const dragOriginXRef = useRef<number>(0);
  const gyroEnabledRef = useRef<boolean>(false);
  const gyroTiltRef = useRef<number>(0);
  const gyroNeutralRef = useRef<number | null>(null);
  const titleHoverTiltRef = useRef<number>(0);
  const titleIdleTimeRef = useRef<number>(0);

  const clearAllInputs = useCallback(() => {
    keysHeldRef.current.clear();
    buttonTiltRef.current = 0;
    canvasDragTiltRef.current = 0;
    isCanvasDraggingRef.current = false;
    gyroTiltRef.current = 0;
  }, []);

  const syncBodyState = useCallback((nextPhase: GamePhase) => {
    phaseRef.current = nextPhase;
    document.body.dataset.state = nextPhase;
  }, []);

  const handleSelectDifficulty = useCallback((nextDiff: DifficultyLevel) => {
    difficultyRef.current = nextDiff;
    setDifficulty(nextDiff);
    physicsRef.current.difficulty = nextDiff;
  }, []);

  const handleSelectSkin = useCallback((nextSkin: SkinId) => {
    if (!isSkinUnlocked(shopStateRef.current, nextSkin)) return;
    skinRef.current = nextSkin;
    setSelectedSkin(nextSkin);
    saveSelectedSkin(nextSkin);
    rendererRef.current.setSkin(nextSkin);
  }, []);

  const handleBuySkin = useCallback((skinId: SkinId) => {
    const res = buySkin(shopStateRef.current, skinId);
    if (!res.success) return;
    gameAudio.unlock();
    gameAudio.playShopPurchase();
    shopStateRef.current = res.nextState;
    setShopState(res.nextState);
    saveShopState(res.nextState);
    skinRef.current = skinId;
    setSelectedSkin(skinId);
    saveSelectedSkin(skinId);
    rendererRef.current.setSkin(skinId);
  }, []);

  const handleBuyConsumable = useCallback((itemId: ShopConsumableId) => {
    const res = buyConsumable(shopStateRef.current, itemId);
    if (!res.success) return;
    gameAudio.unlock();
    gameAudio.playShopPurchase();
    shopStateRef.current = res.nextState;
    setShopState(res.nextState);
    saveShopState(res.nextState);
  }, []);

  const handleBuyUpgrade = useCallback((upgradeId: ShopUpgradeId) => {
    const res = buyUpgrade(shopStateRef.current, upgradeId);
    if (!res.success) return;
    gameAudio.unlock();
    gameAudio.playShopPurchase();
    shopStateRef.current = res.nextState;
    setShopState(res.nextState);
    saveShopState(res.nextState);
  }, []);

  const handleToggleReward = useCallback((rewardId: SpecialRewardId) => {
    const next = toggleSpecialReward(missionStateRef.current, rewardId);
    missionStateRef.current = next;
    setMissionState(next);
    saveDailyMissionState(next);
    rendererRef.current.setActiveRewards(next.activeRewards);
  }, []);

  const startNewRun = useCallback(() => {
    gameAudio.unlock();
    gameAudio.playStart();
    clearAllInputs();
    setOpenShopOnTitle(false);

    const activeDifficulty = difficultyRef.current;
    let activeShop = shopStateRef.current;
    const fresh = createInitialPhysicsState(Date.now() & 0xffffffff, activeDifficulty);
    fresh.targetChargeMultiplier = getTargetChargeMultiplier(activeShop);
    fresh.edgeShieldsRemaining = activeShop.consumables.edge_shield > 0 ? 1 : 0;

    if (activeShop.consumables.start_stabilizer > 0) {
      activeShop = consumeConsumable(activeShop, 'start_stabilizer');
      shopStateRef.current = activeShop;
      setShopState(activeShop);
      saveShopState(activeShop);
      fresh.activePowerUp = {
        type: 'stabilizer',
        remaining: POWERUP_PRESETS.stabilizer.duration,
        duration: POWERUP_PRESETS.stabilizer.duration,
      };
    }

    physicsRef.current = fresh;
    rendererRef.current.resetEffects();
    rendererRef.current.setActiveRewards(missionStateRef.current.activeRewards);
    runStartBestRef.current = bestScoreRef.current;
    newBestCelebratedRef.current = false;
    maxComboRef.current = 1;
    powerUpsUsedRef.current = 0;
    runCoinsEarnedRef.current = 0;
    runMissionsCompletedRef.current = 0;
    runMissionBonusRef.current = 0;
    runUnlockedRewardsRef.current = [];
    missionBannerRef.current = null;
    missionBannerTimerRef.current = 0;
    setEndRun(null);

    setHud({
      difficulty: activeDifficulty,
      score: 0,
      bestScore: bestScoreRef.current,
      elapsedSeconds: 0,
      combo: 1,
      targetsCleared: 0,
      level: 1,
      angleDegrees: 0,
      windPhase: 'calm',
      windDir: 1,
      edgeDanger: 0,
      activePowerUp: fresh.activePowerUp ? { ...fresh.activePowerUp } : null,
      activeMonster: null,
      missionBanner: null,
      runCoins: 0,
      totalCoins: activeShop.coins,
      edgeShields: fresh.edgeShieldsRemaining,
    });

    syncBodyState('playing');
    setPhase('playing');
    canvasRef.current?.focus();
  }, [clearAllInputs, syncBodyState]);

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    clearAllInputs();
    syncBodyState('paused');
    setPhase('paused');
  }, [clearAllInputs, syncBodyState]);

  const resumeGame = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    clearAllInputs();
    syncBodyState('playing');
    setPhase('playing');
    canvasRef.current?.focus();
  }, [clearAllInputs, syncBodyState]);

  const returnToTitle = useCallback((openShop = false) => {
    clearAllInputs();
    physicsRef.current = createInitialPhysicsState(20261119, difficultyRef.current);
    rendererRef.current.resetEffects();
    setEndRun(null);
    setOpenShopOnTitle(openShop);
    syncBodyState('title');
    setPhase('title');
  }, [clearAllInputs, syncBodyState]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      gameAudio.setMuted(next);
      return next;
    });
  }, []);

  const toggleGyro = useCallback(async () => {
    if (!gyroSupported) return;
    if (gyroEnabledRef.current) {
      gyroEnabledRef.current = false;
      gyroTiltRef.current = 0;
      gyroNeutralRef.current = null;
      setGyroEnabled(false);
      return;
    }

    const DevOrient = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof DevOrient?.requestPermission === 'function') {
      try {
        const res = await DevOrient.requestPermission();
        if (res === 'denied') return;
      } catch {
        // Ignore non-iOS permission errors and attempt attaching listener cleanly
      }
    }

    gyroNeutralRef.current = null;
    gyroTiltRef.current = 0;
    gyroEnabledRef.current = true;
    setGyroEnabled(true);
  }, [gyroSupported]);

  // Listen to device orientation when sensor tilt mode is enabled
  useEffect(() => {
    if (!gyroEnabled) return;
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (phaseRef.current !== 'playing') return;
      const isLandscape = window.innerWidth > window.innerHeight;
      const orientAngle =
        typeof window.screen?.orientation?.angle === 'number'
          ? window.screen.orientation.angle
          : ((window as unknown as { orientation?: number }).orientation ?? 0);
      const rawDeg =
        isLandscape || Math.abs(orientAngle) === 90 || Math.abs(orientAngle) === 270
          ? (e.beta ?? 0) * (orientAngle === 270 || orientAngle === -90 ? -1 : 1)
          : (e.gamma ?? 0) * (orientAngle === 180 ? -1 : 1);

      if (gyroNeutralRef.current === null && Number.isFinite(rawDeg)) {
        // Clamp calibration offset within natural holding comfort range
        gyroNeutralRef.current = Math.max(-25, Math.min(25, rawDeg));
      }

      gyroTiltRef.current = computeGyroTiltInput(
        { gamma: e.gamma, beta: e.beta, orientationAngle: orientAngle },
        isLandscape,
        gyroNeutralRef.current ?? 0
      );
    };

    window.addEventListener('deviceorientation', onDeviceOrientation);
    return () => {
      window.removeEventListener('deviceorientation', onDeviceOrientation);
    };
  }, [gyroEnabled]);

  // Keep body data-state synced on mount
  useEffect(() => {
    syncBodyState(phaseRef.current);
  }, [syncBodyState]);

  // Global keyboard & focus-loss hygiene
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      if (code === 'KeyM' && !e.repeat) {
        toggleMute();
        return;
      }

      if (phaseRef.current === 'title') {
        if ((code === 'Enter' || code === 'Space') && !e.repeat) {
          if (
            document.querySelector('[data-testid="skin-picker-drawer"]') ||
            document.querySelector('[data-testid="daily-missions-drawer"]') ||
            document.querySelector('[data-testid="shop-drawer"]')
          ) {
            return;
          }
          e.preventDefault();
          startNewRun();
        }
        return;
      }

      if (phaseRef.current === 'gameover') {
        if ((code === 'Enter' || code === 'Space') && !e.repeat) {
          e.preventDefault();
          startNewRun();
        }
        return;
      }

      if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
        e.preventDefault();
        if (phaseRef.current === 'playing') {
          pauseGame();
        } else if (phaseRef.current === 'paused') {
          resumeGame();
        }
        return;
      }

      if (code === 'KeyR' && !e.repeat && (phaseRef.current === 'playing' || phaseRef.current === 'paused')) {
        e.preventDefault();
        startNewRun();
        return;
      }

      if (phaseRef.current === 'playing') {
        if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowRight' || code === 'KeyD') {
          e.preventDefault();
          keysHeldRef.current.add(code);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const onWindowBlur = () => {
      clearAllInputs();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearAllInputs();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [clearAllInputs, pauseGame, resumeGame, startNewRun, toggleMute]);

  // Isolated 60fps simulation & Canvas2D render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cssWidth = canvas.clientWidth || window.innerWidth;
    let cssHeight = canvas.clientHeight || window.innerHeight;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      cssWidth = Math.max(1, rect.width);
      cssHeight = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.round(cssWidth * dpr);
      const targetH = Math.round(cssHeight * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

    let rafId = 0;
    let lastTime = performance.now();
    let hudAccumulator = 0;
    let lastHudScore = -1;
    let lastHudTime = -1;
    let lastHudCombo = -1;
    let lastHudWind = '';
    let lastHudMonster = '';
    let lastHudDanger = false;
    let lastHudTilt: -1 | 0 | 1 = 0;
    let lastRenderedPhase: GamePhase | null = null;
    let lastRenderedW = 0;
    let lastRenderedH = 0;

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      const currentPhase = phaseRef.current;
      const sim = physicsRef.current;
      const renderer = rendererRef.current;

      const phaseChanged = currentPhase !== lastRenderedPhase;
      const sizeChanged = cssWidth !== lastRenderedW || cssHeight !== lastRenderedH;
      const shouldTickEffects = currentPhase === 'playing' || renderer.hasActiveEffects();

      if (shouldTickEffects || currentPhase === 'title') {
        renderer.tickVisuals(dt);
      }

      if (currentPhase === 'title') {
        // Gentle interactive centerpiece sway on Title Screen with live skin effect preview
        titleIdleTimeRef.current += dt;
        const idleAngle = Math.sin(titleIdleTimeRef.current * 1.1) * 0.035;
        const targetShowcaseAngle = titleHoverTiltRef.current + idleAngle;
        stepPhysics(sim, dt, 0, targetShowcaseAngle);
        // Keep ball safely centered on title showcase
        sim.ballX *= Math.exp(-3 * dt);
        sim.ballVel *= Math.exp(-4 * dt);

        const worldPos = ballBoardToWorld(sim.boardAngle, sim.ballX);
        renderer.recordTrailPoint(worldPos.x, worldPos.y, Math.max(45, Math.abs(sim.ballVel)));
        renderer.emitAmbientForBall(worldPos.x, worldPos.y, sim.ballVel, dt);
      } else if (currentPhase === 'playing') {
        const keys = keysHeldRef.current;
        const leftHeld = keys.has('ArrowLeft') || keys.has('KeyA');
        const rightHeld = keys.has('ArrowRight') || keys.has('KeyD');
        let tiltInput = (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);

        if (tiltInput === 0 && buttonTiltRef.current !== 0) {
          tiltInput = buttonTiltRef.current;
        }
        if (tiltInput === 0 && isCanvasDraggingRef.current) {
          tiltInput = canvasDragTiltRef.current;
        }
        if (tiltInput === 0 && gyroEnabledRef.current && Math.abs(gyroTiltRef.current) > 0.01) {
          tiltInput = gyroTiltRef.current;
        }

        const events = stepPhysics(sim, dt, tiltInput);

        // Record ball world position & speed for motion trail + ambient skin FX
        if (sim.isFalling) {
          const speed = Math.hypot(sim.fallVx, sim.fallVy);
          renderer.recordTrailPoint(sim.fallWorldX, sim.fallWorldY, speed);
          renderer.emitAmbientForBall(sim.fallWorldX, sim.fallWorldY, speed, dt);
        } else {
          const worldPos = ballBoardToWorld(sim.boardAngle, sim.ballX);
          renderer.recordTrailPoint(worldPos.x, worldPos.y, sim.ballVel);
          renderer.emitAmbientForBall(worldPos.x, worldPos.y, sim.ballVel, dt);
        }

        const skinFx = renderer.getSkin().fx;
        const hasSupernova = renderer.hasActiveReward('supernova_fx');

        for (const ev of events) {
          if (ev.type === 'target_enter') {
            gameAudio.playTargetEnter();
          } else if (ev.type === 'target_complete') {
            const combo = ev.combo ?? 1;
            const pts = ev.points ?? 100;
            const earnedCoins = calculateTargetVictoryCoins({
              level: sim.level,
              combo,
              difficulty: sim.difficulty,
              coinMultiplierLevel: shopStateRef.current.upgrades.coin_multiplier,
            });
            runCoinsEarnedRef.current += earnedCoins;
            const nextShop = awardCoins(shopStateRef.current, earnedCoins);
            shopStateRef.current = nextShop;
            setShopState(nextShop);
            saveShopState(nextShop);

            maxComboRef.current = Math.max(maxComboRef.current, combo + 1);
            gameAudio.playTargetComplete(combo);
            gameAudio.playCoinEarned();
            const worldPos = ballBoardToWorld(sim.boardAngle, sim.ballX);
            renderer.spawnBurst(worldPos.x, worldPos.y, hasSupernova ? 28 : 18, skinFx.burstColor);
            renderer.spawnShockwave(worldPos.x, worldPos.y, skinFx.shockwaveColor, hasSupernova ? 96 : 76);
            if (hasSupernova) {
              renderer.spawnShockwave(worldPos.x, worldPos.y, '#fef08a', 54);
            }
            renderer.spawnCallout(worldPos.x, worldPos.y, `+${pts} · +${earnedCoins} Koin`, '#34d399');
          } else if (ev.type === 'powerup_collected') {
            powerUpsUsedRef.current += 1;
            const pType = ev.powerUpType ?? 'slow_motion';
            const color = pType === 'slow_motion' ? '#38bdf8' : '#34d399';
            const label = POWERUP_PRESETS[pType].label;
            gameAudio.playPowerUpCollect(pType);
            const worldPos = ballBoardToWorld(sim.boardAngle, ev.x ?? sim.ballX);
            renderer.spawnBurst(worldPos.x, worldPos.y, hasSupernova ? 24 : 16, color);
            renderer.spawnShockwave(worldPos.x, worldPos.y, color, hasSupernova ? 82 : 64);
            renderer.spawnCallout(worldPos.x, worldPos.y, label, color);
          } else if (ev.type === 'wind_telegraph') {
            gameAudio.playWindTelegraph();
          } else if (ev.type === 'wind_gust') {
            gameAudio.playWindGust();
          } else if (ev.type === 'edge_danger') {
            gameAudio.playEdgeWarning();
          } else if (ev.type === 'edge_hit') {
            const intensity = ev.intensity ?? 0.5;
            gameAudio.playImpact(intensity);
            renderer.triggerImpactShake(intensity, ev.dir ?? 0, 0.35);
            const edgeX = ev.x ?? Math.sign(sim.ballX) * (PHYSICS_CONSTANTS.BOARD_HALF_LEN - 16);
            const worldPos = ballBoardToWorld(sim.boardAngle, edgeX);
            renderer.spawnBurst(worldPos.x, worldPos.y, 7, skinFx.burstColor);
            renderer.spawnShockwave(worldPos.x, worldPos.y, skinFx.shockwaveColor, 46);
          } else if (ev.type === 'hard_bounce') {
            const intensity = ev.intensity ?? 0.45;
            gameAudio.playImpact(intensity * 0.85);
            renderer.triggerImpactShake(intensity * 0.72, 0, (ev.dir ?? 1) * 0.55);
          } else if (ev.type === 'monster_telegraph') {
            gameAudio.playMonsterTelegraph();
          } else if (ev.type === 'monster_spawn') {
            const mKind = ev.monsterKind ?? 'monkey';
            const mColor = MONSTER_PRESETS[mKind].color;
            gameAudio.playMonsterImpact(mKind);
            const worldPos = ballBoardToWorld(sim.boardAngle, ev.x ?? 0);
            if (mKind === 'titan') {
              renderer.triggerImpactShake(0.85, 0, 0.65);
              renderer.spawnBurst(worldPos.x, worldPos.y, 18, mColor);
              renderer.spawnShockwave(worldPos.x, worldPos.y, mColor, 86);
              renderer.spawnCallout(worldPos.x, worldPos.y - 16, 'TITAN DATANG!', mColor);
            } else {
              renderer.triggerImpactShake((ev.intensity ?? 0.44) * 0.62, 0, 0.45);
              renderer.spawnBurst(worldPos.x, worldPos.y, 12, mColor);
              renderer.spawnShockwave(worldPos.x, worldPos.y, mColor, 58);
            }
          } else if (ev.type === 'monster_hit') {
            const mKind = ev.monsterKind ?? 'robot';
            const intensity = ev.intensity ?? 0.65;
            const mPreset = MONSTER_PRESETS[mKind];
            const isHeavyImpact = intensity >= 0.7 || mKind === 'titan' || mKind === 'human';

            gameAudio.playMonsterImpact(mKind);
            if (isHeavyImpact) {
              gameAudio.playHeavyCollisionDistortion(intensity);
            }

            const shakePower = mKind === 'titan' ? 1.1 : mKind === 'human' ? 0.92 : intensity;
            renderer.triggerImpactShake(shakePower, ev.dir ?? 0, mKind === 'titan' ? 0.42 : 0.25);
            const worldPos = ballBoardToWorld(sim.boardAngle, ev.x ?? sim.ballX);
            renderer.spawnBurst(
              worldPos.x,
              worldPos.y,
              mKind === 'titan' ? 28 : mKind === 'human' ? 20 : 14,
              mKind === 'titan' ? '#fb923c' : '#facc15'
            );
            renderer.spawnShockwave(
              worldPos.x,
              worldPos.y,
              mPreset.color,
              mKind === 'titan' ? 112 : mKind === 'human' ? 88 : 64
            );
            if (isHeavyImpact) {
              renderer.triggerScreenDistortion(
                intensity,
                worldPos.x,
                worldPos.y,
                mPreset.color,
                mKind === 'titan' ? 1.1 : 0.95
              );
            }
            if (mKind === 'titan') {
              renderer.spawnCallout(worldPos.x, worldPos.y - 18, 'BENTURAN TITAN!', '#fb923c');
            } else if (mKind === 'human') {
              renderer.spawnCallout(worldPos.x, worldPos.y - 14, 'TUBRUKAN BERAT!', '#facc15');
            }
          } else if (ev.type === 'monster_leave') {
            const bonusCoins = scaleBonusCoins(5, shopStateRef.current.upgrades.coin_multiplier);
            runCoinsEarnedRef.current += bonusCoins;
            const nextShop = awardCoins(shopStateRef.current, bonusCoins);
            shopStateRef.current = nextShop;
            setShopState(nextShop);
            saveShopState(nextShop);
            const worldPos = ballBoardToWorld(sim.boardAngle, ev.x ?? 0);
            renderer.spawnBurst(worldPos.x, worldPos.y, 8, '#cbd5e1');
            renderer.spawnCallout(worldPos.x, worldPos.y, `+${ev.points ?? 25} · +${bonusCoins} Koin`, '#f5c469');
          } else if (ev.type === 'shield_save') {
            const nextShop = consumeConsumable(shopStateRef.current, 'edge_shield');
            shopStateRef.current = nextShop;
            setShopState(nextShop);
            saveShopState(nextShop);
            gameAudio.playPowerUpCollect('stabilizer');
            renderer.triggerImpactShake(0.7, -(ev.dir ?? 1), 0.3);
            const worldPos = ballBoardToWorld(sim.boardAngle, ev.x ?? sim.ballX);
            renderer.spawnBurst(worldPos.x, worldPos.y, 20, '#38bdf8');
            renderer.spawnShockwave(worldPos.x, worldPos.y, '#38bdf8', 84);
            renderer.spawnCallout(worldPos.x, worldPos.y, 'PERISAI TEPI!', '#38bdf8');
          } else if (ev.type === 'ball_fall_start') {
            gameAudio.playBallFall();
            renderer.triggerImpactShake(ev.intensity ?? 0.85, ev.dir ?? Math.sign(sim.ballX), 0.75);
            const edgeX = Math.sign(sim.ballX) * PHYSICS_CONSTANTS.BOARD_HALF_LEN;
            const worldPos = ballBoardToWorld(sim.boardAngle, edgeX);
            renderer.spawnBurst(worldPos.x, worldPos.y, 16, '#fb7185');
            renderer.spawnShockwave(worldPos.x, worldPos.y, '#fb7185', 80);
          } else if (ev.type === 'game_over') {
            const finalScore = Math.round(sim.score);
            const prevBest = bestScoreRef.current;
            const isNewBest = finalScore > prevBest;
            const nextBest = Math.max(prevBest, finalScore);

            if (isNewBest) {
              bestScoreRef.current = nextBest;
              setBestScore(nextBest);
              saveBestScore(nextBest);
              if (!newBestCelebratedRef.current) {
                newBestCelebratedRef.current = true;
                renderer.spawnConfettiExplosion(2000, cssWidth, cssHeight);
              }
            }

            setEndRun({
              difficulty: sim.difficulty,
              score: finalScore,
              bestScore: nextBest,
              elapsedSeconds: sim.elapsedTime,
              targetsCleared: sim.targetsCleared,
              maxCombo: maxComboRef.current,
              level: sim.level,
              isNewBest,
              missionsCompletedCount: runMissionsCompletedRef.current,
              missionBonusPoints: runMissionBonusRef.current,
              unlockedRewardNames: [...runUnlockedRewardsRef.current],
              coinsEarned: runCoinsEarnedRef.current,
              totalCoins: shopStateRef.current.coins,
            });
            clearAllInputs();
            syncBodyState('gameover');
            setPhase('gameover');
          }
        }

        // Trigger full-screen confetti explosion on breaking high score live
        if (!sim.isFalling && !sim.isGameOver && !newBestCelebratedRef.current) {
          const liveIntScore = Math.round(sim.score);
          const brokeExistingRecord =
            runStartBestRef.current > 0 && liveIntScore > runStartBestRef.current;
          const achievedFirstRecord =
            runStartBestRef.current === 0 && sim.targetsCleared >= 1 && liveIntScore > 0;

          if (brokeExistingRecord || achievedFirstRecord) {
            newBestCelebratedRef.current = true;
            renderer.spawnConfettiExplosion(2000, cssWidth, cssHeight);
            const worldPos = ballBoardToWorld(sim.boardAngle, sim.ballX);
            renderer.spawnCallout(worldPos.x, worldPos.y - 22, 'REKOR BARU!', '#fde047');
            if (brokeExistingRecord) {
              gameAudio.playTargetComplete(10);
            }
          }
        }

        // Evaluate daily missions live during active run
        if (!sim.isFalling && !sim.isGameOver) {
          const prevMissionState = missionStateRef.current;
          const prevUnlocked = new Set(prevMissionState.unlockedRewards);
          const evalRes = evaluateDailyMissions(prevMissionState, {
            targetsCleared: sim.targetsCleared,
            level: sim.level,
            powerUpsUsed: powerUpsUsedRef.current,
            maxCombo: maxComboRef.current,
            elapsedSeconds: sim.elapsedTime,
            score: sim.score,
            difficulty: sim.difficulty,
          });

          if (evalRes.newlyCompleted.length > 0) {
            missionStateRef.current = evalRes.nextState;
            setMissionState(evalRes.nextState);
            saveDailyMissionState(evalRes.nextState);
            renderer.setActiveRewards(evalRes.nextState.activeRewards);

            let batchBonus = 0;
            let latestRewardName: string | undefined;
            for (const m of evalRes.newlyCompleted) {
              batchBonus += m.bonusPoints;
              if (m.rewardId && !prevUnlocked.has(m.rewardId)) {
                const rName = SPECIAL_REWARDS[m.rewardId].name;
                latestRewardName = rName;
                if (!runUnlockedRewardsRef.current.includes(rName)) {
                  runUnlockedRewardsRef.current.push(rName);
                }
              }
            }

            sim.score += batchBonus;
            runMissionsCompletedRef.current += evalRes.newlyCompleted.length;
            runMissionBonusRef.current += batchBonus;

            const missionCoins = scaleBonusCoins(
              50 * evalRes.newlyCompleted.length,
              shopStateRef.current.upgrades.coin_multiplier
            );
            runCoinsEarnedRef.current += missionCoins;
            const nextShop = awardCoins(shopStateRef.current, missionCoins);
            shopStateRef.current = nextShop;
            setShopState(nextShop);
            saveShopState(nextShop);

            const lastCompleted = evalRes.newlyCompleted[evalRes.newlyCompleted.length - 1];
            missionBannerRef.current = {
              title: lastCompleted.title,
              bonusPoints: batchBonus,
              rewardName: latestRewardName,
            };
            missionBannerTimerRef.current = 3.4;

            gameAudio.playTargetComplete(8);
            gameAudio.playCoinEarned();
            const worldPos = ballBoardToWorld(sim.boardAngle, sim.ballX);
            renderer.spawnBurst(worldPos.x, worldPos.y, 24, '#facc15');
            renderer.spawnShockwave(worldPos.x, worldPos.y, '#facc15', 92);
            renderer.spawnCallout(
              worldPos.x,
              worldPos.y - 14,
              `Misi +${batchBonus} · +${missionCoins} Koin`,
              '#facc15'
            );
          }
        }

        if (missionBannerTimerRef.current > 0) {
          missionBannerTimerRef.current = Math.max(0, missionBannerTimerRef.current - dt);
          if (missionBannerTimerRef.current === 0) {
            missionBannerRef.current = null;
          }
        }

        // Throttled / discrete HUD sync
        hudAccumulator += dt;
        const intScore = Math.round(sim.score);
        const intTime = Math.floor(sim.elapsedTime);
        const dangerFlag = sim.edgeDanger > 0.65;
        const windKey = `${sim.windPhase}-${sim.windDir}`;
        const leadMonster = sim.monsters[0] ?? null;
        const monsterKey = leadMonster ? `${leadMonster.id}-${leadMonster.phase}` : '';
        const activeTiltDir = (tiltInput > 0.08 ? 1 : tiltInput < -0.08 ? -1 : 0) as -1 | 0 | 1;

        if (
          hudAccumulator >= 0.08 ||
          intScore !== lastHudScore ||
          intTime !== lastHudTime ||
          sim.combo !== lastHudCombo ||
          windKey !== lastHudWind ||
          monsterKey !== lastHudMonster ||
          dangerFlag !== lastHudDanger ||
          activeTiltDir !== lastHudTilt
        ) {
          hudAccumulator = 0;
          lastHudScore = intScore;
          lastHudTime = intTime;
          lastHudCombo = sim.combo;
          lastHudWind = windKey;
          lastHudMonster = monsterKey;
          lastHudDanger = dangerFlag;
          lastHudTilt = activeTiltDir;

          setHud({
            difficulty: sim.difficulty,
            score: intScore,
            bestScore: Math.max(bestScoreRef.current, intScore),
            elapsedSeconds: sim.elapsedTime,
            combo: sim.combo,
            targetsCleared: sim.targetsCleared,
            level: sim.level,
            angleDegrees: Math.round((sim.boardAngle * 180) / Math.PI),
            windPhase: sim.windPhase,
            windDir: sim.windDir,
            edgeDanger: sim.edgeDanger,
            activePowerUp: sim.activePowerUp ? { ...sim.activePowerUp } : null,
            activeMonster: leadMonster
              ? { kind: leadMonster.kind, phase: leadMonster.phase, x: leadMonster.x }
              : null,
            missionBanner: missionBannerRef.current ? { ...missionBannerRef.current } : null,
            runCoins: runCoinsEarnedRef.current,
            totalCoins: shopStateRef.current.coins,
            edgeShields: sim.edgeShieldsRemaining,
            tiltDir: activeTiltDir,
          });
        }
      }

      const needsRender =
        currentPhase === 'title' ||
        currentPhase === 'playing' ||
        phaseChanged ||
        sizeChanged ||
        renderer.hasActiveEffects();

      if (needsRender) {
        const dpr = canvas.width / cssWidth;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderer.render(ctx, cssWidth, cssHeight, sim, currentPhase, skinRef.current);
        ctx.restore();
        lastRenderedPhase = currentPhase;
        lastRenderedW = cssWidth;
        lastRenderedH = cssHeight;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [clearAllInputs, syncBodyState]);

  // Pointer interaction on canvas (showcase tilt on title, drag/tap tilt while playing)
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current === 'playing') {
      gameAudio.unlock();
      isCanvasDraggingRef.current = true;
      dragOriginXRef.current = e.clientX;
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      // Tapping left or right half tilts in that direction immediately
      canvasDragTiltRef.current = Math.abs(relX) > 0.04 ? Math.sign(relX) : 0;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (phaseRef.current === 'title') {
      const normX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      titleHoverTiltRef.current = Math.max(-0.14, Math.min(0.14, normX * 0.12));
      return;
    }

    if (phaseRef.current === 'playing' && isCanvasDraggingRef.current) {
      const deltaX = e.clientX - dragOriginXRef.current;
      if (Math.abs(deltaX) > 8) {
        canvasDragTiltRef.current = Math.max(-1, Math.min(1, deltaX / 64));
      }
    }
  };

  const handleCanvasPointerUp = () => {
    isCanvasDraggingRef.current = false;
    canvasDragTiltRef.current = 0;
  };

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#161b21]">
      {/* Isolated Canvas Mount */}
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          data-testid="game-canvas"
          tabIndex={0}
          aria-label="Arena Papan Keseimbangan Neraca"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
          className="block h-full w-full touch-none select-none cursor-grab outline-none active:cursor-grabbing"
        />
      </div>

      {phase === 'title' && (
        <TitleScreen
          bestScore={bestScore}
          difficulty={difficulty}
          selectedSkin={selectedSkin}
          missionState={missionState}
          shopState={shopState}
          initialShopOpen={openShopOnTitle}
          onConsumeInitialShopOpen={() => setOpenShopOnTitle(false)}
          onSelectDifficulty={handleSelectDifficulty}
          onSelectSkin={handleSelectSkin}
          onBuySkin={handleBuySkin}
          onBuyConsumable={handleBuyConsumable}
          onBuyUpgrade={handleBuyUpgrade}
          onToggleReward={handleToggleReward}
          onStart={startNewRun}
        />
      )}

      {(phase === 'playing' || phase === 'paused' || phase === 'gameover') && (
        <GameHud
          hud={hud}
          muted={muted}
          gyroSupported={gyroSupported}
          gyroEnabled={gyroEnabled}
          onToggleMute={toggleMute}
          onToggleGyro={toggleGyro}
          onPause={pauseGame}
          onRestart={startNewRun}
          onTiltPointer={(dir) => {
            gameAudio.unlock();
            buttonTiltRef.current = dir;
          }}
        />
      )}

      <StatusModal
        phase={phase}
        endRun={endRun}
        onResume={resumeGame}
        onRestart={startNewRun}
        onOpenShop={() => returnToTitle(true)}
        onReturnTitle={() => returnToTitle(false)}
      />
    </main>
  );
}
