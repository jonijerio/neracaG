import React from 'react';
import { DIFFICULTY_PRESETS, HudSnapshot, POWERUP_PRESETS } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
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
  onToggleMute,
  onPause,
  onRestart,
  onTiltPointer,
}) => {
  const difficultyLabel = DIFFICULTY_PRESETS[hud.difficulty]?.label ?? 'Normal';
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

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Perimeter Bar */}
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        {/* Top-Left: Score & Run Metrics */}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 sm:gap-x-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] sm:text-[11px]">
              Skor
            </div>
            <div
              data-testid="hud-score"
              className="font-mono-num text-2xl font-bold leading-none text-[#f4f1ea] sm:text-4xl"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
            >
              {Math.round(hud.score)}
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

            {hud.combo > 1 && (
              <div>
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] sm:text-[11px]">
                  Kombo
                </span>
                <span className="font-mono-num font-bold text-[#34d399]">
                  x{hud.combo}
                </span>
              </div>
            )}

            <div className="hidden sm:block">
              <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                Rekor
              </span>
              <span className="font-mono-num font-semibold text-[#f5c469]">
                {Math.round(hud.bestScore)}
              </span>
            </div>
          </div>
        </div>

        {/* Top-Center: Mission Completion / Active Power-Up / Live Hazard Alert */}
        <div className="hidden min-h-6 flex-col items-center justify-center gap-1 sm:flex">
          {hud.missionBanner ? (
            <div data-testid="hud-mission-banner" className="flex flex-col items-center text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[#facc15]">
                Misi Selesai: {hud.missionBanner.title} · +{hud.missionBanner.bonusPoints} Poin
              </span>
              {hud.missionBanner.rewardName && (
                <span className="text-[11px] font-semibold text-[#34d399]">
                  Hadiah Terbuka: {hud.missionBanner.rewardName}
                </span>
              )}
            </div>
          ) : hud.edgeDanger > 0.65 ? (
            <span className="text-xs font-bold uppercase tracking-wider text-[#fb7185]">
              Awas Tepi Papan!
            </span>
          ) : windLabel ? (
            <span className="text-xs font-bold uppercase tracking-wider text-[#7dd3fc]">
              {windLabel}
            </span>
          ) : activePowerUpInfo ? (
            <div data-testid="hud-powerup" className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wide">
                <span className={activePowerUpInfo.isSlow ? 'text-[#38bdf8]' : 'text-[#34d399]'}>
                  {activePowerUpInfo.label}
                </span>
                <span className="font-mono-num text-[#cbd5e1]">
                  {activePowerUpInfo.remaining.toFixed(1)}d
                </span>
              </div>
              <div className="h-1 w-28 overflow-hidden rounded-full bg-[#252f3a]">
                <div
                  className={activePowerUpInfo.isSlow ? 'h-full bg-[#38bdf8]' : 'h-full bg-[#34d399]'}
                  style={{ width: `${activePowerUpInfo.pct}%` }}
                />
              </div>
            </div>
          ) : (
            <span className="text-xs font-medium text-[#64748b]">
              {difficultyLabel} · Level {hud.level} · Target {hud.targetsCleared}
            </span>
          )}
        </div>

        {/* Top-Right: Compact World-Matched Utility Icon Buttons */}
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Nyalakan Suara' : 'Matikan Suara'}
            title={muted ? 'Nyalakan Suara (M)' : 'Matikan Suara (M)'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#334155] bg-[#1e252e]/90 text-[#e2e8f0] transition-colors hover:border-[#d89b3c] hover:text-[#f5c469] sm:h-10 sm:w-10"
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
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#334155] bg-[#1e252e]/90 text-[#e2e8f0] transition-colors hover:border-[#d89b3c] hover:text-[#f5c469] sm:h-10 sm:w-10"
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
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#334155] bg-[#1e252e]/90 text-[#e2e8f0] transition-colors hover:border-[#d89b3c] hover:text-[#f5c469] sm:h-10 sm:w-10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="9" y1="6" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom Perimeter: Subtle Touch/Pointer Tilt Paddles & Hint */}
      <div className="flex items-end justify-between gap-4">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Miringkan Kiri"
          onPointerDown={(e) => {
            e.preventDefault();
            onTiltPointer(-1);
          }}
          onPointerUp={() => onTiltPointer(0)}
          onPointerLeave={() => onTiltPointer(0)}
          onPointerCancel={() => onTiltPointer(0)}
          className="pointer-events-auto flex h-12 min-w-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#334155] bg-[#1b222a]/90 px-4 text-sm font-semibold text-[#e2e8f0] transition-transform duration-100 hover:border-[#d89b3c] active:scale-95 active:border-[#e89b2d] active:text-[#f5c469]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Kiri</span>
        </button>

        <div className="hidden pb-1 text-center text-xs text-[#64748b] md:block">
          Tahan bola di zona target bercahaya untuk bonus kombo
        </div>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Miringkan Kanan"
          onPointerDown={(e) => {
            e.preventDefault();
            onTiltPointer(1);
          }}
          onPointerUp={() => onTiltPointer(0)}
          onPointerLeave={() => onTiltPointer(0)}
          onPointerCancel={() => onTiltPointer(0)}
          className="pointer-events-auto flex h-12 min-w-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#334155] bg-[#1b222a]/90 px-4 text-sm font-semibold text-[#e2e8f0] transition-transform duration-100 hover:border-[#d89b3c] active:scale-95 active:border-[#e89b2d] active:text-[#f5c469]"
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
