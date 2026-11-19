import React from 'react';
import { EndRunSnapshot, GamePhase } from '../game/types';

interface StatusModalProps {
  phase: GamePhase;
  endRun: EndRunSnapshot | null;
  onResume: () => void;
  onRestart: () => void;
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
  onReturnTitle,
}) => {
  if (phase !== 'paused' && phase !== 'gameover') {
    return null;
  }

  const isPaused = phase === 'paused';

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-[#0c1015]/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#3f4b5b] bg-[#192028] p-6 shadow-2xl sm:p-8">
        <h2 id="modal-title" className="font-display text-2xl font-bold text-[#f4f1ea] sm:text-3xl">
          {isPaused ? 'Permainan Dijeda' : 'Bola Terjatuh!'}
        </h2>

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
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                  Skor Akhir
                </div>
                <div className="font-mono-num mt-1 text-2xl font-bold text-[#f4f1ea]">
                  {Math.round(endRun.score)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                  Rekor
                </div>
                <div className="font-mono-num mt-1 text-2xl font-bold text-[#f5c469]">
                  {Math.round(endRun.bestScore)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                  Waktu
                </div>
                <div className="font-mono-num mt-1 text-lg font-bold text-[#cbd5e1]">
                  {formatDuration(endRun.elapsedSeconds)}
                </div>
              </div>
            </div>

            {endRun.missionsCompletedCount > 0 && (
              <div
                data-testid="endrun-mission-summary"
                className="mt-3 rounded-lg border border-[#10b981]/40 bg-[#132924] px-3.5 py-2.5 text-xs"
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
              className="flex-1 cursor-pointer whitespace-nowrap rounded-lg bg-[#e89b2d] px-5 py-3 text-sm font-bold text-[#14181e] transition-colors hover:bg-[#f0aa42]"
            >
              Lanjutkan
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="flex-1 cursor-pointer whitespace-nowrap rounded-lg bg-[#e89b2d] px-5 py-3 text-sm font-bold text-[#14181e] transition-colors hover:bg-[#f0aa42]"
            >
              Main Lagi
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="cursor-pointer whitespace-nowrap rounded-lg border border-[#3b4757] bg-[#222b35] px-4 py-3 text-sm font-semibold text-[#e2e8f0] transition-colors hover:border-[#d89b3c]"
            >
              Ulangi
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onReturnTitle();
            }}
            className="cursor-pointer whitespace-nowrap rounded-lg border border-[#3b4757] bg-transparent px-4 py-3 text-sm font-semibold text-[#cbd5e1] transition-colors hover:bg-[#222b35] hover:text-[#f4f1ea]"
          >
            Menu Utama
          </button>
        </div>
      </div>
    </div>
  );
};
