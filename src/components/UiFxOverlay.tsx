import React from 'react';

interface SparkBurstProps {
  burstKey: number;
  label?: string;
  color?: string;
  intense?: boolean;
  className?: string;
}

const SPARK_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

/**
 * Lightweight CSS-animated spark burst + floating callout for UI purchases,
 * coin rewards, target clears, and level-up feedback. Zero layout thrash, zero backdrop-filter.
 */
export const SparkBurst: React.FC<SparkBurstProps> = ({
  burstKey,
  label,
  color = '#fde047',
  intense = false,
  className = '',
}) => {
  if (burstKey <= 0) return null;

  const angles = intense ? SPARK_ANGLES : SPARK_ANGLES.filter((_, idx) => idx % 2 === 0);

  return (
    <span
      key={burstKey}
      aria-hidden="true"
      className={`pointer-events-none relative inline-flex items-center justify-center ${className}`}
    >
      <span
        className={`neraca-ring-pulse absolute rounded-full border-2 ${
          intense ? 'h-10 w-10' : 'h-7 w-7'
        }`}
        style={{ borderColor: color }}
      />
      {intense && (
        <span
          className="neraca-ring-pulse absolute h-6 w-6 rounded-full border border-white/80"
          style={{ animationDelay: '70ms' }}
        />
      )}
      {angles.map((deg) => (
        <span
          key={deg}
          className={`neraca-spark-ray absolute rounded-full ${
            intense ? 'h-2.5 w-[2.5px]' : 'h-2 w-0.5'
          }`}
          style={
            {
              backgroundColor: color,
              '--spark-rot': `${deg}deg`,
            } as React.CSSProperties
          }
        />
      ))}
      {label && (
        <span
          className="neraca-float-up font-mono-num relative z-10 whitespace-nowrap text-xs font-extrabold drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
          style={{ color }}
        >
          {label}
        </span>
      )}
    </span>
  );
};

interface SheenSweepProps {
  colorClass?: string;
}

export const SheenSweep: React.FC<SheenSweepProps> = ({
  colorClass = 'bg-white/35',
}) => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
  >
    <span
      className={`neraca-sheen absolute inset-y-0 left-0 w-10 ${colorClass}`}
    />
  </span>
);

const CONFETTI_CHIPS = [
  { x: '-64px', color: '#fde047', delay: '0ms' },
  { x: '-38px', color: '#34d399', delay: '60ms' },
  { x: '-16px', color: '#38bdf8', delay: '120ms' },
  { x: '18px', color: '#fb923c', delay: '40ms' },
  { x: '44px', color: '#f472b6', delay: '90ms' },
  { x: '68px', color: '#fde047', delay: '150ms' },
];

export const ModalCelebrationConfetti: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 flex justify-center overflow-visible"
    >
      {CONFETTI_CHIPS.map((chip, idx) => (
        <span
          key={idx}
          className="neraca-confetti-chip absolute top-2 h-2.5 w-1.5 rounded-xs"
          style={
            {
              backgroundColor: chip.color,
              animationDelay: chip.delay,
              '--cf-x': chip.x,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
};
