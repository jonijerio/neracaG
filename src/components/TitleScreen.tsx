import React, { useEffect, useState } from 'react';
import {
  DAILY_MISSION_POOL,
  DailyMissionSaveState,
  SPECIAL_REWARDS,
  SPECIAL_REWARD_ORDER,
  SpecialRewardId,
} from '../game/missions';
import { SKIN_ORDER, SKIN_PRESETS, SkinId } from '../game/skins';
import { DIFFICULTY_PRESETS, DifficultyLevel } from '../game/types';

interface TitleScreenProps {
  bestScore: number;
  difficulty: DifficultyLevel;
  selectedSkin: SkinId;
  missionState: DailyMissionSaveState;
  onSelectDifficulty: (difficulty: DifficultyLevel) => void;
  onSelectSkin: (skinId: SkinId) => void;
  onToggleReward: (rewardId: SpecialRewardId) => void;
  onStart: () => void;
}

const DIFFICULTY_DESCRIPTIONS: Record<DifficultyLevel, string> = {
  easy: 'Gesekan bola tinggi · Papan lebih stabil',
  normal: 'Gesekan bola & respons papan seimbang',
  hard: 'Gesekan bola rendah · Papan sangat responsif',
};

const DIFFICULTY_ORDER: DifficultyLevel[] = ['easy', 'normal', 'hard'];

const SkinMiniSwatch: React.FC<{ skinId: SkinId }> = ({ skinId }) => {
  const skin = SKIN_PRESETS[skinId];
  const isPrism = skin.board.pattern === 'prism';
  const boardBg = isPrism
    ? 'linear-gradient(90deg, #f472b6, #38bdf8, #fde047)'
    : `linear-gradient(180deg, ${skin.board.gradTop}, ${skin.board.gradMid}, ${skin.board.gradBottom})`;

  return (
    <span
      aria-hidden="true"
      className="relative flex h-8 w-11 shrink-0 items-center justify-center rounded border border-white/10 bg-[#11161d]"
    >
      {/* Mini glowing ball */}
      <span
        className="absolute top-1.5 h-3 w-3 rounded-full"
        style={{
          background: `radial-gradient(circle at 32% 32%, ${skin.ball.gradHighlight}, ${skin.ball.gradMid} 55%, ${skin.ball.gradCore})`,
          boxShadow: skin.ball.auraColor ? `0 0 6px ${skin.ball.auraColor}` : undefined,
        }}
      />
      {/* Mini board beam */}
      <span
        className="mt-3.5 flex h-1.5 w-8 items-center justify-between overflow-hidden rounded-xs"
        style={{ background: boardBg }}
      >
        <span className="h-full w-1" style={{ backgroundColor: skin.board.capTop }} />
        <span className="h-full w-1" style={{ backgroundColor: skin.board.capTop }} />
      </span>
    </span>
  );
};

export const TitleScreen: React.FC<TitleScreenProps> = ({
  bestScore,
  difficulty,
  selectedSkin,
  missionState,
  onSelectDifficulty,
  onSelectSkin,
  onToggleReward,
  onStart,
}) => {
  const [skinDrawerOpen, setSkinDrawerOpen] = useState(false);
  const [missionDrawerOpen, setMissionDrawerOpen] = useState(false);

  const anyDrawerOpen = skinDrawerOpen || missionDrawerOpen;
  const completedCount = missionState.completedIds.length;
  const totalMissions = missionState.missionIds.length;

  useEffect(() => {
    if (!anyDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSkinDrawerOpen(false);
        setMissionDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [anyDrawerOpen]);

  const activeSkin = SKIN_PRESETS[selectedSkin] ?? SKIN_PRESETS.classic;
  const currentIdx = Math.max(0, SKIN_ORDER.indexOf(activeSkin.id));

  const cycleSkin = (delta: number) => {
    const nextIdx = (currentIdx + delta + SKIN_ORDER.length) % SKIN_ORDER.length;
    onSelectSkin(SKIN_ORDER[nextIdx]);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-5 sm:p-6 md:p-12 lg:p-16">
      {/* Main negative-space left-third lockup (hidden cleanly when drawer is open to prevent bleed-through) */}
      <div
        className={`flex flex-1 flex-col items-center justify-start pt-2 text-center transition-opacity duration-150 md:max-w-md md:items-start md:justify-center md:pt-0 md:text-left ${
          anyDrawerOpen ? 'invisible opacity-0' : 'opacity-100'
        }`}
      >
        {/* Bespoke inline SVG Title Emblem & Wordmark */}
        <svg
          viewBox="0 0 360 112"
          className="h-auto w-56 sm:w-68 md:w-80"
          role="img"
          aria-label="Neraca"
        >
          {/* Decorative balance fulcrum & sphere motif */}
          <g transform="translate(8, 12)">
            <line
              x1="4"
              y1="26"
              x2="76"
              y2="14"
              stroke={activeSkin.board.accentColor}
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="40" cy="11" r="7.5" fill={activeSkin.ball.gradHighlight} stroke="#181e25" strokeWidth="1.5" />
            <path
              d="M40 24 L31 38 L49 38 Z"
              fill={activeSkin.fulcrum.pedestalFill}
              stroke={activeSkin.board.accentColor}
              strokeWidth="1.5"
            />
          </g>

          {/* Wordmark */}
          <text
            x="6"
            y="94"
            fill="#f4f1ea"
            fontFamily="'Bricolage Grotesque', system-ui, sans-serif"
            fontWeight="800"
            fontSize="58"
            letterSpacing="-1.5"
          >
            NERACA
          </text>
          <line
            x1="8"
            y1="105"
            x2="112"
            y2="105"
            stroke={activeSkin.board.accentColor}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#cbd5e1] sm:text-base md:mt-4 md:text-lg">
          Jaga bola tetap seimbang di atas papan yang miring dan kumpulkan poin di setiap zona target.
        </p>

        {bestScore > 0 && (
          <div className="mt-2.5 flex items-baseline gap-2.5 text-sm text-[#94a3b8]">
            <span>Rekor Terbaik</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-base font-bold text-[#f5c469]">
              {bestScore.toLocaleString('id-ID')}
            </span>
            {missionState.activeRewards.includes('master_badge') && (
              <span
                title="Lencana Master Neraca Aktif"
                className="text-xs font-bold text-[#facc15]"
              >
                ★ Master
              </span>
            )}
          </div>
        )}

        {/* Segmented Difficulty Selector */}
        <div className="pointer-events-auto mt-4 flex flex-col items-center md:mt-5 md:items-start">
          <div
            role="group"
            aria-label="Tingkat Kesulitan"
            className="inline-flex items-center gap-1 rounded-lg border border-[#334155] bg-[#1a2129] p-1"
          >
            {DIFFICULTY_ORDER.map((id) => {
              const active = difficulty === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectDifficulty(id);
                  }}
                  className={`cursor-pointer whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5c469] ${
                    active
                      ? 'bg-[#2b3644] text-[#f5c469] shadow-sm'
                      : 'text-[#94a3b8] hover:text-[#e2e8f0]'
                  }`}
                >
                  {DIFFICULTY_PRESETS[id].label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-[#94a3b8]">
            {DIFFICULTY_DESCRIPTIONS[difficulty]}
          </p>
        </div>

        {/* Compact Skin Selector Bar with Prev/Next & 15-Skin Gallery Trigger */}
        <div className="pointer-events-auto mt-3.5 flex w-full max-w-[358px] items-center gap-1 rounded-lg border border-[#334155] bg-[#1a2129]/95 p-1 sm:max-w-sm">
          <button
            type="button"
            aria-label="Skin Sebelumnya"
            onClick={(e) => {
              e.currentTarget.blur();
              cycleSkin(-1);
            }}
            className="flex h-10 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#94a3b8] transition-colors hover:bg-[#252f3c] hover:text-[#f4f1ea] sm:w-9"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            type="button"
            data-testid="open-skin-picker"
            aria-expanded={skinDrawerOpen}
            onClick={(e) => {
              e.currentTarget.blur();
              setSkinDrawerOpen((prev) => !prev);
            }}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[#252f3c] sm:gap-2.5 sm:px-2"
          >
            <SkinMiniSwatch skinId={activeSkin.id} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-[#f4f1ea]">
                  {activeSkin.name}
                </span>
                <span className="font-mono-num shrink-0 text-[11px] font-semibold text-[#94a3b8]">
                  {currentIdx + 1}/{SKIN_ORDER.length}
                </span>
              </div>
              <div className="truncate text-[11px] text-[#94a3b8]">
                {activeSkin.effectTag}
              </div>
            </div>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-[#f5c469]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Skin Berikutnya"
            onClick={(e) => {
              e.currentTarget.blur();
              cycleSkin(1);
            }}
            className="flex h-10 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#94a3b8] transition-colors hover:bg-[#252f3c] hover:text-[#f4f1ea] sm:w-9"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="pointer-events-auto mt-4 flex flex-wrap items-center justify-center gap-3 md:mt-5 md:justify-start">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="cursor-pointer whitespace-nowrap rounded-lg bg-[#e89b2d] px-7 py-3 text-base font-bold text-[#14181e] shadow-lg transition-transform duration-150 hover:bg-[#f0aa42] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5c469] sm:py-3.5"
          >
            Mulai Main
          </button>

          <button
            type="button"
            data-testid="open-daily-missions"
            aria-expanded={missionDrawerOpen}
            onClick={(e) => {
              e.currentTarget.blur();
              setSkinDrawerOpen(false);
              setMissionDrawerOpen((prev) => !prev);
            }}
            className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-[#334155] bg-[#1a2129]/95 px-4 py-3 text-sm font-semibold text-[#e2e8f0] transition-colors hover:border-[#d89b3c] hover:text-[#f5c469] sm:py-3.5"
          >
            <span>Misi Harian</span>
            <span
              className={`font-mono-num text-xs font-bold ${
                completedCount >= totalMissions ? 'text-[#34d399]' : 'text-[#f5c469]'
              }`}
            >
              {completedCount}/{totalMissions}
            </span>
          </button>
        </div>
      </div>

      {/* Single flat borderless control-hint line */}
      <div
        className={`text-center text-xs tracking-wide text-[#94a3b8] transition-opacity duration-150 md:text-left md:text-sm ${
          anyDrawerOpen ? 'invisible opacity-0' : 'opacity-100'
        }`}
      >
        A / D atau Panah Kiri / Kanan untuk memiringkan · Sentuh atau Seret · P Jeda · M Suara
      </div>

      {/* Left-docked 15-Skin Gallery Panel (keeps desktop right-side board live & visible) */}
      {skinDrawerOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Koleksi 15 Skin Neraca dan Bola"
          data-testid="skin-picker-drawer"
          className="pointer-events-auto fixed inset-x-4 top-4 bottom-4 z-30 flex flex-col rounded-xl border border-[#3b4757] bg-[#151b23] p-4 shadow-2xl md:inset-x-auto md:top-6 md:bottom-6 md:left-8 md:w-[500px]"
        >
          <div className="flex items-center justify-between border-b border-[#283240] pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#f4f1ea]">
                Skin Neraca &amp; Bola
              </h2>
              <p className="text-xs text-[#94a3b8]">
                15 tema material dengan jejak &amp; efek partikel aktif
              </p>
            </div>
            <button
              type="button"
              aria-label="Tutup Daftar Skin"
              onClick={() => setSkinDrawerOpen(false)}
              className="cursor-pointer rounded-lg border border-[#334155] bg-[#1e2631] px-3 py-1.5 text-xs font-semibold text-[#e2e8f0] transition-colors hover:border-[#d89b3c] hover:text-[#f5c469]"
            >
              Selesai
            </button>
          </div>

          <div className="mt-3 grid flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {SKIN_ORDER.map((id, idx) => {
              const skin = SKIN_PRESETS[id];
              const isSelected = selectedSkin === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isSelected}
                  data-testid={`skin-option-${id}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectSkin(id);
                  }}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                    isSelected
                      ? 'border-[#e89b2d] bg-[#242e3b]'
                      : 'border-[#27313f] bg-[#1a222b] hover:border-[#475569] hover:bg-[#202935]'
                  }`}
                >
                  <SkinMiniSwatch skinId={id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`truncate text-xs font-bold ${isSelected ? 'text-[#f5c469]' : 'text-[#f4f1ea]'}`}>
                        {skin.name}
                      </span>
                      <span className="font-mono-num shrink-0 text-[10px] text-[#64748b]">
                        #{idx + 1}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[#94a3b8]">
                      {skin.effectTag}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Left-docked Daily Missions & Special Rewards Panel */}
      {missionDrawerOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Misi Harian dan Hadiah Spesial"
          data-testid="daily-missions-drawer"
          className="pointer-events-auto fixed inset-x-4 top-4 bottom-4 z-30 flex flex-col rounded-xl border border-[#3b4757] bg-[#151b23] p-4 shadow-2xl md:inset-x-auto md:top-6 md:bottom-6 md:left-8 md:w-[490px]"
        >
          <div className="flex items-center justify-between border-b border-[#283240] pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#f4f1ea]">
                Misi Harian
              </h2>
              <p className="text-xs text-[#94a3b8]">
                {missionState.dateKey} · Selesaikan dalam 1 permainan untuk bonus poin &amp; hadiah
              </p>
            </div>
            <button
              type="button"
              aria-label="Tutup Misi Harian"
              onClick={() => setMissionDrawerOpen(false)}
              className="cursor-pointer rounded-lg border border-[#334155] bg-[#1e2631] px-3 py-1.5 text-xs font-semibold text-[#e2e8f0] transition-colors hover:border-[#d89b3c] hover:text-[#f5c469]"
            >
              Selesai
            </button>
          </div>

          <div className="mt-3 flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
            {/* 3 Today's Challenges */}
            <div className="flex flex-col gap-2">
              {missionState.missionIds.map((mId) => {
                const def = DAILY_MISSION_POOL[mId];
                const isDone = missionState.completedIds.includes(mId);
                const rewardInfo = def.rewardId ? SPECIAL_REWARDS[def.rewardId] : null;
                return (
                  <div
                    key={mId}
                    data-testid={`mission-card-${mId}`}
                    className={`rounded-lg border p-3 ${
                      isDone
                        ? 'border-[#10b981]/60 bg-[#132924]'
                        : 'border-[#27313f] bg-[#1a222b]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-[#f4f1ea]">
                          {def.title}
                        </div>
                        <div className="mt-0.5 text-xs text-[#cbd5e1]">
                          {def.description}
                        </div>
                      </div>
                      <span
                        className={`font-mono-num shrink-0 text-xs font-bold ${
                          isDone ? 'text-[#34d399]' : 'text-[#f5c469]'
                        }`}
                      >
                        {isDone ? 'Selesai' : `+${def.bonusPoints} Poin`}
                      </span>
                    </div>
                    {rewardInfo && (
                      <div className="mt-2 text-[11px] font-medium text-[#94a3b8]">
                        Hadiah Spesial:{' '}
                        <span className="text-[#fde047]">{rewardInfo.name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Unlockable Special Rewards */}
            <div className="border-t border-[#283240] pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
                  Hadiah Spesial ({missionState.unlockedRewards.length}/{SPECIAL_REWARD_ORDER.length})
                </h3>
                <span className="font-mono-num text-[11px] text-[#64748b]">
                  Total Misi: {missionState.totalCompletedAllTime}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {SPECIAL_REWARD_ORDER.map((rId) => {
                  const info = SPECIAL_REWARDS[rId];
                  const unlocked = missionState.unlockedRewards.includes(rId);
                  const active = missionState.activeRewards.includes(rId);
                  return (
                    <div
                      key={rId}
                      data-testid={`reward-card-${rId}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[#27313f] bg-[#182029] p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#f4f1ea]">
                          {info.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#94a3b8]">
                          {info.description}
                        </div>
                      </div>
                      {unlocked ? (
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={(e) => {
                            e.currentTarget.blur();
                            onToggleReward(rId);
                          }}
                          className={`shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                            active
                              ? 'bg-[#e89b2d] text-[#14181e]'
                              : 'border border-[#334155] bg-[#1e2631] text-[#cbd5e1] hover:border-[#d89b3c]'
                          }`}
                        >
                          {active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      ) : (
                        <span className="shrink-0 text-[11px] font-semibold text-[#64748b]">
                          Terkunci
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
