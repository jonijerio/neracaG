import React, { useEffect, useState } from 'react';
import {
  DAILY_MISSION_POOL,
  DailyMissionSaveState,
  SPECIAL_REWARDS,
  SPECIAL_REWARD_ORDER,
  SpecialRewardId,
} from '../game/missions';
import {
  SHOP_CONSUMABLES,
  SHOP_CONSUMABLE_ORDER,
  SHOP_UPGRADES,
  SHOP_UPGRADE_ORDER,
  SKIN_PRICES,
  ShopConsumableId,
  ShopSaveState,
  ShopUpgradeId,
  getUpgradePrice,
  isSkinUnlocked,
} from '../game/shop';
import { SKIN_ORDER, SKIN_PRESETS, SkinId } from '../game/skins';
import { DIFFICULTY_PRESETS, DifficultyLevel } from '../game/types';
import { SheenSweep, SparkBurst } from './UiFxOverlay';

interface TitleScreenProps {
  bestScore: number;
  difficulty: DifficultyLevel;
  selectedSkin: SkinId;
  missionState: DailyMissionSaveState;
  shopState: ShopSaveState;
  initialShopOpen?: boolean;
  onConsumeInitialShopOpen?: () => void;
  onSelectDifficulty: (difficulty: DifficultyLevel) => void;
  onSelectSkin: (skinId: SkinId) => void;
  onBuySkin: (skinId: SkinId) => void;
  onBuyConsumable: (itemId: ShopConsumableId) => void;
  onBuyUpgrade: (upgradeId: ShopUpgradeId) => void;
  onToggleReward: (rewardId: SpecialRewardId) => void;
  onStart: () => void;
}

const DIFFICULTY_DESCRIPTIONS: Record<DifficultyLevel, string> = {
  easy: 'Gesekan bola tinggi · Papan lebih stabil',
  normal: 'Gesekan bola & respons papan seimbang',
  hard: 'Gesekan bola rendah · Papan sangat responsif',
};

const DIFFICULTY_ORDER: DifficultyLevel[] = ['easy', 'normal', 'hard'];

const CoinIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
    <circle cx="12" cy="12" r="9.5" fill="#eab308" stroke="#fef08a" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="6" stroke="#a16207" strokeWidth="1.4" />
    <path d="M12 8.5v7M10 10.5h3.2a1.3 1.3 0 0 1 0 2.6H10.8a1.3 1.3 0 0 0 0 2.6H14" stroke="#713f12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
      <span
        className="absolute top-1.5 h-3 w-3 rounded-full"
        style={{
          background: `radial-gradient(circle at 32% 32%, ${skin.ball.gradHighlight}, ${skin.ball.gradMid} 55%, ${skin.ball.gradCore})`,
          boxShadow: skin.ball.auraColor ? `0 0 6px ${skin.ball.auraColor}` : undefined,
        }}
      />
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
  shopState,
  initialShopOpen = false,
  onConsumeInitialShopOpen,
  onSelectDifficulty,
  onSelectSkin,
  onBuySkin,
  onBuyConsumable,
  onBuyUpgrade,
  onToggleReward,
  onStart,
}) => {
  const [skinDrawerOpen, setSkinDrawerOpen] = useState(false);
  const [missionDrawerOpen, setMissionDrawerOpen] = useState(false);
  const [shopDrawerOpen, setShopDrawerOpen] = useState(initialShopOpen);
  const [shopTab, setShopTab] = useState<'skins' | 'items'>('skins');
  const [purchaseFx, setPurchaseFx] = useState<{ key: number; label: string; color: string }>({
    key: 0,
    label: '',
    color: '#fde047',
  });

  useEffect(() => {
    if (initialShopOpen) {
      setSkinDrawerOpen(false);
      setMissionDrawerOpen(false);
      setShopDrawerOpen(true);
      onConsumeInitialShopOpen?.();
    }
  }, [initialShopOpen, onConsumeInitialShopOpen]);

  const anyDrawerOpen = skinDrawerOpen || missionDrawerOpen || shopDrawerOpen;
  const completedCount = missionState.completedIds.length;
  const totalMissions = missionState.missionIds.length;

  const triggerPurchaseFx = (label: string, color = '#fde047') => {
    setPurchaseFx((prev) => ({ key: prev.key + 1, label, color }));
  };

  useEffect(() => {
    if (!anyDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSkinDrawerOpen(false);
        setMissionDrawerOpen(false);
        setShopDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [anyDrawerOpen]);

  const activeSkin = SKIN_PRESETS[selectedSkin] ?? SKIN_PRESETS.classic;
  const unlockedList = shopState.unlockedSkins.length > 0 ? shopState.unlockedSkins : (['classic'] as SkinId[]);
  const currentUnlockedIdx = Math.max(0, unlockedList.indexOf(activeSkin.id));

  const cycleUnlockedSkin = (delta: number) => {
    const nextIdx = (currentUnlockedIdx + delta + unlockedList.length) % unlockedList.length;
    onSelectSkin(unlockedList[nextIdx]);
  };

  return (
    <div className="safe-area-hud pointer-events-none fixed inset-0 z-10 flex flex-col justify-between md:p-12 lg:p-16">
      {/* Main negative-space left-third lockup */}
      <div
        className={`flex min-h-0 flex-1 flex-col items-center justify-start pt-1 text-center transition-opacity duration-150 [@media(min-width:560px)_and_(max-height:520px)]:max-w-sm [@media(min-width:560px)_and_(max-height:520px)]:items-start [@media(min-width:560px)_and_(max-height:520px)]:justify-center [@media(min-width:560px)_and_(max-height:520px)]:pt-0 [@media(min-width:560px)_and_(max-height:520px)]:text-left md:max-w-md md:items-start md:justify-center md:pt-0 md:text-left ${
          anyDrawerOpen ? 'invisible opacity-0' : 'opacity-100'
        }`}
      >
        <svg
          viewBox="0 0 360 112"
          className="neraca-enter-up h-auto w-44 sm:w-64 [@media(max-height:520px)]:w-36 md:w-80"
          role="img"
          aria-label="Neraca"
        >
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

        <p
          className="neraca-enter-up mt-2 max-w-sm text-xs leading-relaxed text-[#cbd5e1] sm:text-base [@media(max-height:520px)]:hidden md:mt-3 md:text-lg"
          style={{ animationDelay: '55ms' }}
        >
          Jaga bola tetap seimbang di atas papan yang miring dan kumpulkan koin di setiap kemenangan.
        </p>

        {/* Coin Wallet & Best Score Strip */}
        <div
          className="neraca-enter-up mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-[#cbd5e1] [@media(min-width:560px)_and_(max-height:520px)]:mt-1.5 [@media(min-width:560px)_and_(max-height:520px)]:justify-start md:mt-2.5 md:justify-start"
          style={{ animationDelay: '95ms' }}
        >
          <div className="flex items-center gap-1.5">
            <CoinIcon className="h-4 w-4 drop-shadow-[0_0_6px_rgba(234,179,8,0.45)]" />
            <span
              key={shopState.coins}
              data-testid="title-coins"
              className="neraca-pop font-mono-num inline-block text-base font-bold text-[#fde047]"
            >
              {shopState.coins.toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-[#94a3b8]">Koin</span>
          </div>

          {bestScore > 0 && (
            <div className="flex items-baseline gap-2 text-sm text-[#94a3b8]">
              <span aria-hidden="true">·</span>
              <span>Rekor</span>
              <span className="font-mono-num text-base font-bold text-[#f5c469]">
                {bestScore.toLocaleString('id-ID')}
              </span>
            </div>
          )}

          {missionState.activeRewards.includes('master_badge') && (
            <span title="Lencana Master Neraca Aktif" className="text-xs font-bold text-[#facc15]">
              ★ Master
            </span>
          )}
        </div>

        {/* Segmented Difficulty Selector */}
        <div
          className="neraca-enter-up pointer-events-auto mt-2.5 flex flex-col items-center [@media(min-width:560px)_and_(max-height:520px)]:mt-2 [@media(min-width:560px)_and_(max-height:520px)]:items-start md:mt-4 md:items-start"
          style={{ animationDelay: '130ms' }}
        >
          <div
            role="group"
            aria-label="Tingkat Kesulitan"
            className="inline-flex items-center gap-1 rounded-lg border border-[#334155] bg-[#1a2129] p-1 shadow-md"
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
                  className={`neraca-btn-tactile min-h-9 cursor-pointer whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5c469] sm:px-4 sm:text-sm ${
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
          <p className="mt-1 text-xs text-[#94a3b8] [@media(max-height:520px)]:hidden">
            {DIFFICULTY_DESCRIPTIONS[difficulty]}
          </p>
        </div>

        {/* Compact Skin Selector Bar (cycles owned skins; opens gallery to view/buy all 15) */}
        <div
          className="neraca-enter-up pointer-events-auto mt-2.5 flex w-full max-w-[340px] items-center gap-1 rounded-lg border border-[#334155] bg-[#1a2129]/95 p-1 shadow-md transition-colors hover:border-[#475569] [@media(max-height:520px)]:mt-2 sm:max-w-sm"
          style={{ animationDelay: '165ms' }}
        >
          <button
            type="button"
            aria-label="Skin Sebelumnya"
            onClick={(e) => {
              e.currentTarget.blur();
              cycleUnlockedSkin(-1);
            }}
            className="neraca-btn-tactile flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#94a3b8] hover:bg-[#252f3c] hover:text-[#f4f1ea]"
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
              setShopDrawerOpen(false);
              setMissionDrawerOpen(false);
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
                  {unlockedList.length}/{SKIN_ORDER.length}
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
              cycleUnlockedSkin(1);
            }}
            className="neraca-btn-tactile flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#94a3b8] hover:bg-[#252f3c] hover:text-[#f4f1ea]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Primary Action Row: Play, Shop, Daily Missions */}
        <div
          className="neraca-enter-up pointer-events-auto mt-3 flex flex-wrap items-center justify-center gap-2 [@media(min-width:560px)_and_(max-height:520px)]:mt-2.5 [@media(min-width:560px)_and_(max-height:520px)]:justify-start sm:gap-2.5 md:mt-5 md:justify-start"
          style={{ animationDelay: '205ms' }}
        >
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="neraca-btn-tactile relative min-h-11 cursor-pointer overflow-hidden whitespace-nowrap rounded-lg bg-[#e89b2d] px-5 py-2.5 text-sm font-bold text-[#14181e] shadow-lg hover:bg-[#f0aa42] hover:shadow-[0_6px_22px_rgba(232,155,45,0.38)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5c469] sm:px-6 sm:py-3.5 sm:text-base"
          >
            <SheenSweep />
            <span className="relative z-10">Mulai Main</span>
          </button>

          <button
            type="button"
            data-testid="open-shop"
            aria-expanded={shopDrawerOpen}
            onClick={(e) => {
              e.currentTarget.blur();
              setSkinDrawerOpen(false);
              setMissionDrawerOpen(false);
              setShopDrawerOpen((prev) => !prev);
            }}
            className="neraca-btn-tactile flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-[#d89b3c]/70 bg-[#1e2631] px-4 py-2.5 text-sm font-bold text-[#fde047] hover:border-[#f5c469] hover:bg-[#27313f] hover:shadow-[0_4px_16px_rgba(234,179,8,0.22)] sm:py-3.5"
          >
            <CoinIcon className="h-4 w-4" />
            <span>Toko</span>
          </button>

          <button
            type="button"
            data-testid="open-daily-missions"
            aria-expanded={missionDrawerOpen}
            onClick={(e) => {
              e.currentTarget.blur();
              setSkinDrawerOpen(false);
              setShopDrawerOpen(false);
              setMissionDrawerOpen((prev) => !prev);
            }}
            className="neraca-btn-tactile flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-[#334155] bg-[#1a2129]/95 px-3.5 py-2.5 text-sm font-semibold text-[#e2e8f0] hover:border-[#d89b3c] hover:text-[#f5c469] sm:py-3.5"
          >
            <span>Misi</span>
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
        className={`text-center text-[11px] tracking-wide text-[#cbd5e1]/80 transition-opacity duration-150 [@media(min-width:560px)_and_(max-height:520px)]:text-left md:text-left md:text-sm ${
          anyDrawerOpen ? 'invisible opacity-0' : 'opacity-100'
        }`}
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.65)' }}
      >
        A / D atau Panah untuk memiringkan · Sentuh, Seret, atau Sensor HP · P Jeda · M Suara
      </div>

      {/* Left-docked Shop Drawer (Skins + Consumables & Permanent Upgrades) */}
      {shopDrawerOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Toko Neraca"
          data-testid="shop-drawer"
          className="neraca-drawer-in pointer-events-auto fixed inset-x-4 top-4 bottom-4 z-30 flex max-h-[calc(100dvh-2rem)] flex-col rounded-xl border border-[#3b4757] bg-[#151b23] p-4 shadow-2xl md:inset-x-auto md:top-6 md:bottom-6 md:left-8 md:w-[520px]"
        >
          <div className="flex items-center justify-between border-b border-[#283240] pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#f4f1ea]">
                Toko Neraca
              </h2>
              <div className="relative mt-0.5 flex items-center gap-1.5 text-xs text-[#94a3b8]">
                <CoinIcon className="h-3.5 w-3.5" />
                <span>Saldo:</span>
                <span
                  key={shopState.coins}
                  data-testid="shop-coins"
                  className="neraca-pop font-mono-num inline-block font-bold text-[#fde047]"
                >
                  {shopState.coins.toLocaleString('id-ID')} Koin
                </span>
                <SparkBurst
                  burstKey={purchaseFx.key}
                  label={purchaseFx.label}
                  color={purchaseFx.color}
                  className="ml-2"
                />
              </div>
            </div>
            <button
              type="button"
              aria-label="Tutup Toko"
              onClick={() => setShopDrawerOpen(false)}
              className="neraca-btn-tactile cursor-pointer rounded-lg border border-[#334155] bg-[#1e2631] px-3 py-1.5 text-xs font-semibold text-[#e2e8f0] hover:border-[#d89b3c] hover:text-[#f5c469]"
            >
              Selesai
            </button>
          </div>

          {/* Shop Category Tabs */}
          <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-lg border border-[#283240] bg-[#10151c] p-1">
            <button
              type="button"
              data-testid="shop-tab-skins"
              onClick={() => setShopTab('skins')}
              className={`cursor-pointer rounded-md py-2 text-xs font-bold transition-colors ${
                shopTab === 'skins'
                  ? 'bg-[#263140] text-[#f5c469]'
                  : 'text-[#94a3b8] hover:text-[#e2e8f0]'
              }`}
            >
              Skin ({unlockedList.length}/{SKIN_ORDER.length})
            </button>
            <button
              type="button"
              data-testid="shop-tab-items"
              onClick={() => setShopTab('items')}
              className={`cursor-pointer rounded-md py-2 text-xs font-bold transition-colors ${
                shopTab === 'items'
                  ? 'bg-[#263140] text-[#f5c469]'
                  : 'text-[#94a3b8] hover:text-[#e2e8f0]'
              }`}
            >
              Item &amp; Peningkatan
            </button>
          </div>

          {shopTab === 'skins' ? (
            <div className="mt-3 grid flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {SKIN_ORDER.map((id) => {
                const skin = SKIN_PRESETS[id];
                const unlocked = isSkinUnlocked(shopState, id);
                const isSelected = selectedSkin === id;
                const price = SKIN_PRICES[id];
                const canAfford = shopState.coins >= price;

                return (
                  <div
                    key={id}
                    data-testid={`shop-skin-${id}`}
                    className={`flex flex-col justify-between gap-2 rounded-lg border p-2.5 transition-all duration-150 hover:-translate-y-0.5 ${
                      isSelected
                        ? 'border-[#e89b2d] bg-[#242e3b] shadow-[0_0_14px_rgba(232,155,45,0.18)]'
                        : 'border-[#27313f] bg-[#1a222b] hover:border-[#3e4c5f]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <SkinMiniSwatch skinId={id} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-[#f4f1ea]">
                          {skin.name}
                        </div>
                        <div className="truncate text-[11px] text-[#94a3b8]">
                          {skin.effectTag}
                        </div>
                      </div>
                    </div>

                    {unlocked ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onSelectSkin(id);
                        }}
                        className={`neraca-btn-tactile w-full cursor-pointer rounded-md py-1.5 text-xs font-bold ${
                          isSelected
                            ? 'bg-[#e89b2d] text-[#14181e]'
                            : 'border border-[#334155] bg-[#1e2631] text-[#e2e8f0] hover:border-[#d89b3c]'
                        }`}
                      >
                        {isSelected ? 'Dipakai' : 'Pakai Skin'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford}
                        data-testid={`buy-skin-${id}`}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onBuySkin(id);
                          triggerPurchaseFx(`${skin.name} Terbuka!`, '#34d399');
                        }}
                        className={`neraca-btn-tactile flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold ${
                          canAfford
                            ? 'cursor-pointer bg-[#eab308] text-[#14181e] hover:bg-[#facc15]'
                            : 'cursor-not-allowed border border-[#2d3748] bg-[#141921] text-[#64748b]'
                        }`}
                      >
                        <CoinIcon className="h-3.5 w-3.5" />
                        <span>Beli · {price}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
              {/* Consumables */}
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
                  Perlengkapan Sekali Pakai
                </h3>
                <div className="flex flex-col gap-2">
                  {SHOP_CONSUMABLE_ORDER.map((id) => {
                    const item = SHOP_CONSUMABLES[id];
                    const stock = shopState.consumables[id] ?? 0;
                    const isFull = stock >= item.maxStock;
                    const canAfford = shopState.coins >= item.price && !isFull;

                    return (
                      <div
                        key={id}
                        data-testid={`shop-item-${id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#27313f] bg-[#1a222b] p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#f4f1ea]">
                              {item.name}
                            </span>
                            <span className="font-mono-num text-xs font-semibold text-[#38bdf8]">
                              Stok {stock}/{item.maxStock}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-[#94a3b8]">
                            {item.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={!canAfford}
                          data-testid={`buy-item-${id}`}
                          onClick={(e) => {
                            e.currentTarget.blur();
                            onBuyConsumable(id);
                            triggerPurchaseFx(`${item.name} +1!`, '#38bdf8');
                          }}
                          className={`neraca-btn-tactile flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold ${
                            isFull
                              ? 'cursor-default border border-[#10b981]/40 bg-[#132924] text-[#34d399]'
                              : canAfford
                                ? 'cursor-pointer bg-[#eab308] text-[#14181e] hover:bg-[#facc15]'
                                : 'cursor-not-allowed border border-[#2d3748] bg-[#141921] text-[#64748b]'
                          }`}
                        >
                          {isFull ? (
                            <span>Penuh</span>
                          ) : (
                            <>
                              <CoinIcon className="h-3.5 w-3.5" />
                              <span>{item.price}</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Permanent Upgrades */}
              <div className="border-t border-[#283240] pt-3">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
                  Peningkatan Permanen
                </h3>
                <div className="flex flex-col gap-2">
                  {SHOP_UPGRADE_ORDER.map((id) => {
                    const upg = SHOP_UPGRADES[id];
                    const level = shopState.upgrades[id] ?? 0;
                    const price = getUpgradePrice(shopState, id);
                    const isMax = price === null;
                    const canAfford = price !== null && shopState.coins >= price;

                    return (
                      <div
                        key={id}
                        data-testid={`shop-upgrade-${id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#27313f] bg-[#1a222b] p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#f4f1ea]">
                              {upg.name}
                            </span>
                            <span className="font-mono-num text-xs font-semibold text-[#f5c469]">
                              Lv {level}/{upg.maxLevel}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-[#94a3b8]">
                            {upg.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={!canAfford}
                          data-testid={`buy-upgrade-${id}`}
                          onClick={(e) => {
                            e.currentTarget.blur();
                            onBuyUpgrade(id);
                            triggerPurchaseFx(`${upg.name} Lv ${level + 1}!`, '#fde047');
                          }}
                          className={`neraca-btn-tactile flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold ${
                            isMax
                              ? 'cursor-default border border-[#10b981]/40 bg-[#132924] text-[#34d399]'
                              : canAfford
                                ? 'cursor-pointer bg-[#eab308] text-[#14181e] hover:bg-[#facc15]'
                                : 'cursor-not-allowed border border-[#2d3748] bg-[#141921] text-[#64748b]'
                          }`}
                        >
                          {isMax ? (
                            <span>Maks</span>
                          ) : (
                            <>
                              <CoinIcon className="h-3.5 w-3.5" />
                              <span>{price}</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Left-docked 15-Skin Gallery Panel (shows unlocked & lets user buy locked skins directly) */}
      {skinDrawerOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Koleksi 15 Skin Neraca dan Bola"
          data-testid="skin-picker-drawer"
          className="neraca-drawer-in pointer-events-auto fixed inset-x-4 top-4 bottom-4 z-30 flex max-h-[calc(100dvh-2rem)] flex-col rounded-xl border border-[#3b4757] bg-[#151b23] p-4 shadow-2xl md:inset-x-auto md:top-6 md:bottom-6 md:left-8 md:w-[500px]"
        >
          <div className="flex items-center justify-between border-b border-[#283240] pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#f4f1ea]">
                Skin Neraca &amp; Bola
              </h2>
              <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
                <span>
                  {unlockedList.length}/{SKIN_ORDER.length} terbuka · Saldo {shopState.coins.toLocaleString('id-ID')} Koin
                </span>
                <SparkBurst
                  burstKey={purchaseFx.key}
                  label={purchaseFx.label}
                  color={purchaseFx.color}
                />
              </div>
            </div>
            <button
              type="button"
              aria-label="Tutup Daftar Skin"
              onClick={() => setSkinDrawerOpen(false)}
              className="neraca-btn-tactile cursor-pointer rounded-lg border border-[#334155] bg-[#1e2631] px-3 py-1.5 text-xs font-semibold text-[#e2e8f0] hover:border-[#d89b3c] hover:text-[#f5c469]"
            >
              Selesai
            </button>
          </div>

          <div className="mt-3 grid flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {SKIN_ORDER.map((id) => {
              const skin = SKIN_PRESETS[id];
              const unlocked = isSkinUnlocked(shopState, id);
              const isSelected = selectedSkin === id;
              const price = SKIN_PRICES[id];
              const canAfford = shopState.coins >= price;

              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={!unlocked && !canAfford}
                  data-testid={`skin-option-${id}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    if (unlocked) {
                      onSelectSkin(id);
                    } else if (canAfford) {
                      onBuySkin(id);
                      triggerPurchaseFx(`${skin.name} Terbuka!`, '#34d399');
                    }
                  }}
                  className={`neraca-btn-tactile flex items-center gap-2 rounded-lg border p-2 text-left ${
                    isSelected
                      ? 'cursor-pointer border-[#e89b2d] bg-[#242e3b] shadow-[0_0_12px_rgba(232,155,45,0.18)]'
                      : unlocked
                        ? 'cursor-pointer border-[#27313f] bg-[#1a222b] hover:border-[#475569] hover:bg-[#202935]'
                        : canAfford
                          ? 'cursor-pointer border-[#eab308]/50 bg-[#1a222b] hover:bg-[#242c37]'
                          : 'cursor-not-allowed border-[#202935] bg-[#141a22] opacity-75'
                  }`}
                >
                  <SkinMiniSwatch skinId={id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`truncate text-xs font-bold ${isSelected ? 'text-[#f5c469]' : 'text-[#f4f1ea]'}`}>
                        {skin.name}
                      </span>
                      {!unlocked && (
                        <span className={`font-mono-num shrink-0 text-[10px] font-bold ${canAfford ? 'text-[#fde047]' : 'text-[#64748b]'}`}>
                          {price} Koin
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[#94a3b8]">
                      {unlocked ? skin.effectTag : canAfford ? 'Klik untuk beli & pakai' : 'Terkunci'}
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
          className="neraca-drawer-in pointer-events-auto fixed inset-x-4 top-4 bottom-4 z-30 flex max-h-[calc(100dvh-2rem)] flex-col rounded-xl border border-[#3b4757] bg-[#151b23] p-4 shadow-2xl md:inset-x-auto md:top-6 md:bottom-6 md:left-8 md:w-[490px]"
        >
          <div className="flex items-center justify-between border-b border-[#283240] pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#f4f1ea]">
                Misi Harian
              </h2>
              <p className="text-xs text-[#94a3b8]">
                {missionState.dateKey} · Bonus poin, +50 Koin &amp; hadiah spesial
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
                        {isDone ? 'Selesai' : `+${def.bonusPoints} Poin · +50 Koin`}
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
