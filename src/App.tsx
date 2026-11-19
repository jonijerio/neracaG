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
import { ballBoardToWorld, createInitialPhysicsState, stepPhysics } from './game/physics';
import { BalanceRenderer } from './game/renderer';
import { SKIN_PRESETS, SkinId } from './game/skins';
import {
  DifficultyLevel,
  EndRunSnapshot,
  GamePhase,
  HudSnapshot,
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
  const [selectedSkin, setSelectedSkin] = useState<SkinId>(() => readSavedSkin());
  const [missionState, setMissionState] = useState<DailyMissionSaveState>(() =>
    readDailyMissionState()
  );
  const [muted, setMuted] = useState<boolean>(false);
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
    missionBanner: null,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<GamePhase>(initialPhase);
  const difficultyRef = useRef<DifficultyLevel>('normal');
  const skinRef = useRef<SkinId>(selectedSkin);
  const missionStateRef = useRef<DailyMissionSaveState>(missionState);
  const bestScoreRef = useRef<number>(bestScore);
  const maxComboRef = useRef<number>(1);
  const powerUpsUsedRef = useRef<number>(0);
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
  const titleHoverTiltRef = useRef<number>(0);
  const titleIdleTimeRef = useRef<number>(0);

  const clearAllInputs = useCallback(() => {
    keysHeldRef.current.clear();
    buttonTiltRef.current = 0;
    canvasDragTiltRef.current = 0;
    isCanvasDraggingRef.current = false;
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
    skinRef.current = nextSkin;
    setSelectedSkin(nextSkin);
    saveSelectedSkin(nextSkin);
    rendererRef.current.setSkin(nextSkin);
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

    const activeDifficulty = difficultyRef.current;
    const fresh = createInitialPhysicsState(Date.now() & 0xffffffff, activeDifficulty);
    physicsRef.current = fresh;
    rendererRef.current.resetEffects();
    rendererRef.current.setActiveRewards(missionStateRef.current.activeRewards);
    maxComboRef.current = 1;
    powerUpsUsedRef.current = 0;
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
      activePowerUp: null,
      missionBanner: null,
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

  const returnToTitle = useCallback(() => {
    clearAllInputs();
    physicsRef.current = createInitialPhysicsState(20261119, difficultyRef.current);
    rendererRef.current.resetEffects();
    setEndRun(null);
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
            document.querySelector('[data-testid="daily-missions-drawer"]')
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
    let lastHudDanger = false;
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
            maxComboRef.current = Math.max(maxComboRef.current, combo + 1);
            gameAudio.playTargetComplete(combo);
            const worldPos = ballBoardToWorld(sim.boardAngle, sim.ballX);
            renderer.spawnBurst(worldPos.x, worldPos.y, hasSupernova ? 28 : 18, skinFx.burstColor);
            renderer.spawnShockwave(worldPos.x, worldPos.y, skinFx.shockwaveColor, hasSupernova ? 96 : 76);
            if (hasSupernova) {
              renderer.spawnShockwave(worldPos.x, worldPos.y, '#fef08a', 54);
            }
            renderer.spawnCallout(worldPos.x, worldPos.y, `+${pts}`, '#34d399');
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
            });
            clearAllInputs();
            syncBodyState('gameover');
            setPhase('gameover');
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

            const lastCompleted = evalRes.newlyCompleted[evalRes.newlyCompleted.length - 1];
            missionBannerRef.current = {
              title: lastCompleted.title,
              bonusPoints: batchBonus,
              rewardName: latestRewardName,
            };
            missionBannerTimerRef.current = 3.4;

            gameAudio.playTargetComplete(8);
            const worldPos = ballBoardToWorld(sim.boardAngle, sim.ballX);
            renderer.spawnBurst(worldPos.x, worldPos.y, 24, '#facc15');
            renderer.spawnShockwave(worldPos.x, worldPos.y, '#facc15', 92);
            renderer.spawnCallout(worldPos.x, worldPos.y - 14, `Misi +${batchBonus}`, '#facc15');
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

        if (
          hudAccumulator >= 0.08 ||
          intScore !== lastHudScore ||
          intTime !== lastHudTime ||
          sim.combo !== lastHudCombo ||
          windKey !== lastHudWind ||
          dangerFlag !== lastHudDanger
        ) {
          hudAccumulator = 0;
          lastHudScore = intScore;
          lastHudTime = intTime;
          lastHudCombo = sim.combo;
          lastHudWind = windKey;
          lastHudDanger = dangerFlag;

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
            missionBanner: missionBannerRef.current ? { ...missionBannerRef.current } : null,
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
          className="block h-full w-full cursor-grab outline-none active:cursor-grabbing"
        />
      </div>

      {phase === 'title' && (
        <TitleScreen
          bestScore={bestScore}
          difficulty={difficulty}
          selectedSkin={selectedSkin}
          missionState={missionState}
          onSelectDifficulty={handleSelectDifficulty}
          onSelectSkin={handleSelectSkin}
          onToggleReward={handleToggleReward}
          onStart={startNewRun}
        />
      )}

      {(phase === 'playing' || phase === 'paused' || phase === 'gameover') && (
        <GameHud
          hud={hud}
          muted={muted}
          onToggleMute={toggleMute}
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
        onReturnTitle={returnToTitle}
      />
    </main>
  );
}
