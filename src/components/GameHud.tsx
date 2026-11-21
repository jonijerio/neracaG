import React, { useEffect, useRef, useState } from 'react';
import { computeAtmosphere } from '../game/atmosphere';
import { getComboIndicatorStyle, shouldPulseCombo } from '../game/hudCombo';
import { DIFFICULTY_PRESETS, HudSnapshot, MONSTER_PRESETS, POWERUP_PRESETS } from '../game/types';
import { SparkBurst } from './UiFxOverlay';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  gyroSupported: boolean;
  gyroEnabled: boolean;
  onToggleMute: () => void;
  onToggleGyro: () => void;
  onPause: () => void;
  onRestart: () => void;
  onTiltPointer: (dir: -1 | 0 | 1) => void;
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  muted,
  gyroSupported,
  gyroEnabled,
  onToggleMute,
  onToggleGyro,
  onPause,
  onRestart,
  onTiltPointer,
}) => {
  const prevCoinsRef = useRef<number>(hud.runCoins);
  const prevLevelRef = useRef<number>(hud.level);
  const prevComboRef = useRef<number>(hud.combo);
  const [coinFx, setCoinFx] = useState<{ key: number; delta: number }>({ key: 0, delta: 0 });
  const [comboPulseKey, setComboPulseKey] = useState<number>(hud.combo > 1 ? 1 : 0);
  const [levelBanner, setLevelBanner] = useState<number | null>(null);

  useEffect(() => {
    if (hud.runCoins > prevCoinsRef.current) {
      const delta = hud.runCoins - prevCoinsRef.current;
      setCoinFx((prev) => ({ key: prev.key + 1, delta }));
    }
    prevCoinsRef.current = hud.runCoins;
  }, [hud.runCoins]);

  useEffect(() => {
    if (shouldPulseCombo(prevComboRef.current, hud.combo)) {
      setComboPulseKey((k) => k + 1);
    }
    prevComboRef.current = hud.combo;
  }, [hud.combo]);

  useEffect(() => {
    if (hud.level > prevLevelRef.current) {
      setLevelBanner(hud.level);
      const timer = window.setTimeout(() => setLevelBanner(null), 1600);
      prevLevelRef.current = hud.level;
      return () => window.clearTimeout(timer);
    }
    prevLevelRef.current = hud.level;
    return undefined;
  }, [hud.level]);

  const difficultyLabel = DIFFICULTY_PRESETS[hud.difficulty]?.label ?? 'Normal';
  const atmosphere = computeAtmosphere(hud.level);
  const comboStyle = getComboIndicatorStyle(hud.combo);
  const activePowerUpInfo = hud.activePowerUp
    ? {
        label: POWERUP_PRESETS[hud.activePowerUp.type].label,
        remaining: hud.activePowerUp.remaining,
        pct: Math.max(0, Math.min(100, (hud.activePowerUp.remaining / hud.activePowerUp.duration) * 100)),
        isSlow: hud.activePowerUp.type === 'slow_motion',
      }
    : null;

  const windLabel =
    hud.windPhase === 'telegraph'
      ? hud.windDir > 0
        ? 'Angin Bersiap →'
        : '← Angin Bersiap'
      : hud.windPhase === 'active'
        ? hud.windDir > 0
          ? 'Angin Kencang →'
          : '← Angin Kencang'
        : null;

  const monsterAlert = hud.activeMonster
    ? {
        preset: MONSTER_PRESETS[hud.activeMonster.kind],
        phase: hud.activeMonster.phase,
        side: hud.activeMonster.x < -12 ? 'Kiri' : hud.activeMonster.x > 12 ? 'Kanan' : 'Tengah',
      }
    : null;

  const dangerStrength = Math.max(0, Math.min(1, (hud.edgeDanger - 0.42) / 0.58));
  const leftActive = hud.tiltDir === -1;
  const rightActive = hud.tiltDir === 1;

  const renderCenterStatus = (compact: boolean) => {
    if (hud.missionBanner) {
      return (
        <div
          data-testid={compact ? undefined : 'hud-mission-banner'}
          className="neraca-alert-in flex flex-col items-center text-center"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#facc15] sm:text-xs">
            Misi Selesai: {hud.missionBanner.title} · +{hud.missionBanner.bonusPoints} Poin
          </span>
          {hud.missionBanner.rewardName && (
            <span className="text-[10px] font-semibold text-[#34d399] sm:text-[11px]">
              Hadiah Terbuka: {hud.missionBanner.rewardName}
            </span>
          )}
        </div>
      );
    }

    if (levelBanner !== null) {
      return (
        <div
          key={levelBanner}
          data-testid={compact ? undefined : 'hud-level-up'}
          className="neraca-alert-in flex flex-col items-center text-center"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#fde047] sm:text-xs">
            Naik ke Level {levelBanner}!
          </span>
          <span className="text-[10px] font-medium text-[#cbd5e1] sm:text-[11px]">
            {atmosphere.label}
          </span>
        </div>
      );
    }

    if (hud.edgeDanger > 0.65) {
      return (
        <span className="neraca-alert-in neraca-danger-pulse text-[11px] font-bold uppercase tracking-wider text-[#fb7185] sm:text-xs">
          Awas Tepi Papan!
        </span>
      );
    }

    if (monsterAlert) {
      return (
        <div
          key={`${monsterAlert.preset.kind}-${monsterAlert.phase}`}
          data-testid={compact ? undefined : 'hud-monster-alert'}
          className="neraca-alert-in flex flex-col items-center text-center"
        >
          <span
            className="text-[11px] font-bold uppercase tracking-wider sm:text-xs"
            style={{ color: monsterAlert.preset.color }}
          >
            {monsterAlert.phase === 'telegraph'
              ? `Awas ${monsterAlert.preset.name} (${monsterAlert.side})!`
              : monsterAlert.preset.name}
          </span>
          {!compact && (
            <span className="text-[11px] font-medium text-[#cbd5e1]">
              {monsterAlert.preset.warningText}
            </span>
          )}
        </div>
      );
    }

    if (windLabel) {
      return (
        <span
          key={`${hud.windPhase}-${hud.windDir}`}
          className="neraca-alert-in text-[11px] font-bold uppercase tracking-wider text-[#7dd3fc] sm:text-xs"
        >
          {windLabel}
        </span>
      );
    }

    if (activePowerUpInfo) {
      return (
        <div
          data-testid={compact ? undefined : 'hud-powerup'}
          className="neraca-alert-in flex flex-col items-center gap-1"
        >
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-wide sm:text-xs">
            <span className={activePowerUpInfo.isSlow ? 'text-[#38bdf8]' : 'text-[#34d399]'}>
              {activePowerUpInfo.label}
            </span>
            <span className="font-mono-num text-[#cbd5e1]">
              {activePowerUpInfo.remaining.toFixed(1)}d
            </span>
          </div>
          <div className="relative h-1.5 w-28 overflow-hidden rounded-full bg-[#252f3a]">
            <div
              className={
                activePowerUpInfo.isSlow
                  ? 'relative h-full overflow-hidden bg-[#38bdf8]'
                  : 'relative h-full overflow-hidden bg-[#34d399]'
              }
              style={{ width: `${activePowerUpInfo.pct}%` }}
            >
              <span className="neraca-shimmer absolute inset-y-0 left-0 w-10 bg-white/45" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <span
        data-testid={compact ? undefined : 'hud-atmosphere'}
        className="text-[11px] font-medium text-[#94a3b8] sm:text-xs"
      >
        {compact ? `Lv ${hud.level} · ${atmosphere.label}` : `${difficultyLabel} · Level ${hud.level} · ${atmosphere.label}`}
      </span>
    );
  };

  return (
    <div className="safe-area-hud pointer-events-none fixed inset-0 z-10 flex flex-col justify-between sm:p-6">
      {/* Peripheral Edge Danger Vignette */}
      {dangerStrength > 0.02 && (
        <div
          aria-hidden="true"
          data-testid="hud-danger-vignette"
          className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-150 ${
            hud.edgeDanger > 0.72 ? 'neraca-danger-pulse' : ''
          }`}
          style={{
            opacity: dangerStrength * 0.85,
            boxShadow: 'inset 0 0 84px rgba(244, 63, 94, 0.55)',
          }}
        />
      )}

      {/* Subtle Active Power-Up Perimeter Glow */}
      {activePowerUpInfo && (
        <div
          aria-hidden="true"
          data-testid="hud-powerup-aura"
          className="pointer-events-none fixed inset-x-0 top-0 z-0 h-20 transition-opacity duration-200"
          style={{
            background: activePowerUpInfo.isSlow
              ? 'linear-gradient(180deg, rgba(56, 189, 248, 0.16) 0%, rgba(56, 189, 248, 0) 100%)'
              : 'linear-gradient(180deg, rgba(52, 211, 153, 0.16) 0%, rgba(52, 211, 153, 0) 100%)',
          }}
        />
      )}

      {/* Top Perimeter Bar */}
      <div className="relative z-10 flex items-start justify-between gap-2 sm:gap-4">
        {/* Top-Left: Score & Run Metrics */}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 sm:gap-x-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] sm:text-[11px]">
              Skor
            </div>
            <div className="relative flex items-baseline gap-2 sm:gap-2.5">
              <div
                key={`score-${hud.targetsCleared}`}
                data-testid="hud-score"
                className="neraca-pop font-mono-num text-2xl font-bold leading-none text-[#f4f1ea] sm:text-4xl"
                style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
              >
                {Math.round(hud.score)}
              </div>

              {comboStyle.visible && (
                <div
                  key={`combo-float-${comboPulseKey}`}
                  data-testid="hud-combo-multiplier"
                  aria-live="polite"
                  className="neraca-combo-pulse relative inline-flex -translate-y-0.5 items-center whitespace-nowrap font-mono-num text-xs font-extrabold tracking-tight sm:text-base"
                  style={{
                    color: comboStyle.color,
                    textShadow: `0 2px 8px rgba(0,0,0,0.8), 0 0 14px ${comboStyle.glowColor}`,
                  }}
                >
                  {comboPulseKey > 0 && (
                    <span
                      aria-hidden="true"
                      className="neraca-ring-pulse pointer-events-none absolute -inset-x-2 -inset-y-1 rounded-full border"
                      style={{ borderColor: comboStyle.color }}
                    />
                  )}
                  <span>{comboStyle.label}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-[#cbd5e1] sm:gap-x-4 sm:text-sm">
            <div>
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] sm:mr-1.5 sm:text-[11px]">
                Waktu
              </span>
              <span data-testid="hud-time" className="font-mono-num font-bold text-[#f4f1ea]">
                {formatTime(hud.elapsedSeconds)}
              </span>
            </div>

            <div>
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] sm:mr-1.5 sm:text-[11px]">
                Mode
              </span>
              <span data-testid="hud-difficulty" className="font-semibold text-[#f5c469]">
                {difficultyLabel}
              </span>
            </div>

            <div className="hidden sm:block">
              <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                Rekor
              </span>
              <span className="font-mono-num font-semibold text-[#f5c469]">
                {Math.round(hud.bestScore)}
              </span>
            </div>

            <div className="relative flex items-baseline">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] sm:mr-1.5 sm:text-[11px]">
                Koin
              </span>
              <span
                key={`coins-${hud.runCoins}`}
                data-testid="hud-coins"
                className="neraca-pop font-mono-num inline-block font-bold text-[#fde047]"
              >
                +{hud.runCoins}
              </span>
              {coinFx.key > 0 && (
                <SparkBurst
                  burstKey={coinFx.key}
                  label={`+${coinFx.delta}`}
                  color="#fde047"
                  className="ml-2"
                />
              )}
            </div>

            {hud.edgeShields > 0 && (
              <div>
                <span
                  data-testid="hud-shield"
                  className="neraca-alert-in inline-block text-[10px] font-bold uppercase tracking-wider text-[#38bdf8] sm:text-[11px]"
                >
                  <span className="sm:hidden">Perisai</span>
                  <span className="hidden sm:inline">Perisai Siap</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Top-Center (Tablet & Desktop): Mission / Level-Up / Active Power-Up / Hazard Alert */}
        <div className="hidden min-h-6 flex-col items-center justify-center gap-1 sm:flex">
          {renderCenterStatus(false)}
        </div>

        {/* Top-Right: Compact World-Matched Utility Icon Buttons */}
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {gyroSupported && (
            <button
              type="button"
              tabIndex={-1}
              data-testid="toggle-gyro"
              aria-pressed={gyroEnabled}
              aria-label={gyroEnabled ? 'Matikan Kontrol Sensor Kemiringan' : 'Aktifkan Kontrol Sensor Kemiringan'}
              title={gyroEnabled ? 'Sensor Kemiringan Aktif' : 'Gunakan Sensor Kemiringan HP'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleGyro();
              }}
              className={`neraca-btn-tactile flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
                gyroEnabled
                  ? 'border-[#e89b2d] bg-[#2a2216]/95 text-[#fde047] shadow-[0_0_12px_rgba(232,155,45,0.28)]'
                  : 'border-[#334155] bg-[#1e252e]/90 text-[#e2e8f0] hover:border-[#d89b3c] hover:text-[#f5c469]'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="7" y="3" width="10" height="18" rx="2" transform="rotate(-12 12 12)" />
                <path d="M4 12a8 8 0 0 1 3-6.2" />
                <path d="M20 12a8 8 0 0 1-3 6.2" />
              </svg>
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Nyalakan Suara' : 'Matikan Suara'}
            title={muted ? 'Nyalakan Suara (M)' : 'Matikan Suara (M)'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="neraca-btn-tactile flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[#334155] bg-[#1e252e]/90 text-[#e2e8f0] hover:border-[#d89b3c] hover:text-[#f5c469]"
          >
            {muted ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Ulangi Permainan"
            title="Ulangi (R)"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="neraca-btn-tactile flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[#334155] bg-[#1e252e]/90 text-[#e2e8f0] hover:border-[#d89b3c] hover:text-[#f5c469]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Jeda Permainan"
            title="Jeda (P / Esc)"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="neraca-btn-tactile flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[#334155] bg-[#1e252e]/90 text-[#e2e8f0] hover:border-[#d89b3c] hover:text-[#f5c469]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="9" y1="6" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Compact Alert Strip (ensures warnings, monsters, wind & mission banners show cleanly on < 640px screens) */}
      <div className="relative z-10 mt-1 flex min-h-5 items-center justify-center sm:hidden">
        {renderCenterStatus(true)}
      </div>

      <div className="flex-1" />

      {/* Bottom Perimeter: Reactive Touch/Keyboard Tilt Paddles & Hint */}
      <div className="relative z-10 flex items-end justify-between gap-3 sm:gap-4">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Miringkan Kiri"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture?.(e.pointerId);
            onTiltPointer(-1);
          }}
          onPointerUp={() => onTiltPointer(0)}
          onPointerLeave={() => onTiltPointer(0)}
          onPointerCancel={() => onTiltPointer(0)}
          className={`pointer-events-auto flex min-h-12 min-w-[104px] touch-none select-none cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-all duration-100 active:scale-95 sm:min-w-[116px] ${
            leftActive
              ? 'scale-95 border-[#e89b2d] bg-[#2a2216]/95 text-[#f5c469] shadow-[0_0_16px_rgba(232,155,45,0.28)]'
              : 'border-[#334155] bg-[#1b222a]/90 text-[#e2e8f0] hover:border-[#d89b3c]'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Kiri</span>
        </button>

        <div
          className="hidden pb-1 text-center text-xs font-medium text-[#e2e8f0]/80 md:block"
          style={{ textShadow: '0 1px 4px rgba(0, 0, 0, 0.7)' }}
        >
          {gyroEnabled
            ? 'Mode Sensor Aktif · Miringkan perangkat atau sentuh tombol'
            : 'Tahan bola di zona target bercahaya untuk bonus kombo'}
        </div>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Miringkan Kanan"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture?.(e.pointerId);
            onTiltPointer(1);
          }}
          onPointerUp={() => onTiltPointer(0)}
          onPointerLeave={() => onTiltPointer(0)}
          onPointerCancel={() => onTiltPointer(0)}
          className={`pointer-events-auto flex min-h-12 min-w-[104px] touch-none select-none cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-all duration-100 active:scale-95 sm:min-w-[116px] ${
            rightActive
              ? 'scale-95 border-[#e89b2d] bg-[#2a2216]/95 text-[#f5c469] shadow-[0_0_16px_rgba(232,155,45,0.28)]'
              : 'border-[#334155] bg-[#1b222a]/90 text-[#e2e8f0] hover:border-[#d89b3c]'
          }`}
        >
          <span>Kanan</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
};

