import React from 'react';
import { EndRunSnapshot, GamePhase } from '../game/types';
import { SheenSweep } from './UiFxOverlay';

interface StatusModalProps {
  phase: GamePhase;
  endRun: EndRunSnapshot | null;
  onResume: () => void;
  onRestart: () => void;
  onOpenShop: () => void;
  onReturnTitle: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}d` : `${s} detik`;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  phase,
  endRun,
  onResume,
  onRestart,
  onOpenShop,
  onReturnTitle,
}) => {
  if (phase !== 'paused' && phase !== 'gameover') {
    return null;
  }

  const isPaused = phase === 'paused';

  return (
    <div
      className="neraca-modal-backdrop fixed inset-0 z-20 flex items-center justify-center bg-[#0c1015]/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="neraca-modal-card max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-xl border border-[#3f4b5b] bg-[#192028] p-5 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <h2 id="modal-title" className="font-display text-2xl font-bold text-[#f4f1ea] sm:text-3xl">
            {isPaused ? 'Permainan Dijeda' : 'Bola Terjatuh!'}
          </h2>
          {!isPaused && endRun?.isNewBest && (
            <span className="neraca-alert-in relative shrink-0 overflow-hidden rounded-md border border-[#f5c469]/50 bg-[#2a2112] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#fde047]">
              <SheenSweep colorClass="bg-[#fef08a]/35" />
              <span className="relative z-10">Rekor Baru!</span>
            </span>
          )}
        </div>

        <p className="mt-1.5 text-sm text-[#94a3b8]">
          {isPaused
            ? 'Ambil napas sejenak sebelum melanjutkan keseimbangan.'
            : endRun?.isNewBest
              ? 'Skor tertinggi baru berhasil dicapai!'
              : 'Papan terlalu miring dan bola meluncur melewati tepi.'}
        </p>

        {!isPaused && endRun && (
          <>
            <div className="mt-6 grid grid-cols-3 gap-3 border-y border-[#2b3440] py-4">
              <div className="neraca-enter-up" style={{ animationDelay: '60ms' }}>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                  Skor Akhir
                </div>
                <div className="font-mono-num mt-1 text-2xl font-bold text-[#f4f1ea]">
                  {Math.round(endRun.score)}
                </div>
              </div>
              <div className="neraca-enter-up" style={{ animationDelay: '110ms' }}>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                  Rekor
                </div>
                <div className="font-mono-num mt-1 text-2xl font-bold text-[#f5c469]">
                  {Math.round(endRun.bestScore)}
                </div>
              </div>
              <div className="neraca-enter-up" style={{ animationDelay: '160ms' }}>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                  Waktu
                </div>
                <div className="font-mono-num mt-1 text-lg font-bold text-[#cbd5e1]">
                  {formatDuration(endRun.elapsedSeconds)}
                </div>
              </div>
            </div>

            <div
              data-testid="endrun-coin-summary"
              className="neraca-enter-up relative mt-3 flex items-center justify-between overflow-hidden rounded-lg border border-[#eab308]/35 bg-[#221d12] px-3.5 py-2.5 text-xs"
              style={{ animationDelay: '190ms' }}
            >
              {endRun.coinsEarned > 0 && <SheenSweep colorClass="bg-[#fde047]/15" />}
              <span className="relative z-10 font-bold text-[#fde047]">
                +{endRun.coinsEarned.toLocaleString('id-ID')} Koin Didapat
              </span>
              <span className="font-mono-num relative z-10 font-semibold text-[#e2e8f0]">
                Saldo: {endRun.totalCoins.toLocaleString('id-ID')} Koin
              </span>
            </div>

            {endRun.missionsCompletedCount > 0 && (
              <div
                data-testid="endrun-mission-summary"
                className="neraca-enter-up mt-2.5 rounded-lg border border-[#10b981]/40 bg-[#132924] px-3.5 py-2.5 text-xs"
                style={{ animationDelay: '220ms' }}
              >
                <div className="font-bold text-[#34d399]">
                  {endRun.missionsCompletedCount} Misi Harian Selesai · +{endRun.missionBonusPoints} Bonus Poin
                </div>
                {endRun.unlockedRewardNames.length > 0 && (
                  <div className="mt-0.5 text-[#fde047]">
                    Hadiah Terbuka: {endRun.unlockedRewardNames.join(', ')}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          {isPaused ? (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onResume();
              }}
              className="neraca-btn-tactile relative flex-1 cursor-pointer overflow-hidden whitespace-nowrap rounded-lg bg-[#e89b2d] px-5 py-3 text-sm font-bold text-[#14181e] hover:bg-[#f0aa42]"
            >
              <SheenSweep />
              <span className="relative z-10">Lanjutkan</span>
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="neraca-btn-tactile relative flex-1 cursor-pointer overflow-hidden whitespace-nowrap rounded-lg bg-[#e89b2d] px-5 py-3 text-sm font-bold text-[#14181e] hover:bg-[#f0aa42]"
            >
              <SheenSweep />
              <span className="relative z-10">Main Lagi</span>
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="neraca-btn-tactile cursor-pointer whitespace-nowrap rounded-lg border border-[#3b4757] bg-[#222b35] px-4 py-3 text-sm font-semibold text-[#e2e8f0] hover:border-[#d89b3c]"
            >
              Ulangi
            </button>
          )}

          {!isPaused && (
            <button
              type="button"
              data-testid="endrun-open-shop"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenShop();
              }}
              className="neraca-btn-tactile cursor-pointer whitespace-nowrap rounded-lg border border-[#d89b3c]/70 bg-[#222b35] px-4 py-3 text-sm font-bold text-[#fde047] hover:border-[#f5c469] hover:bg-[#2a3441]"
            >
              Toko
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onReturnTitle();
            }}
            className="neraca-btn-tactile cursor-pointer whitespace-nowrap rounded-lg border border-[#3b4757] bg-transparent px-4 py-3 text-sm font-semibold text-[#cbd5e1] hover:bg-[#222b35] hover:text-[#f4f1ea]"
          >
            Menu Utama
          </button>
        </div>
      </div>
    </div>
  );
};

