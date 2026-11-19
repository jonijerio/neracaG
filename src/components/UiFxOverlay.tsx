import React from 'react';

interface SparkBurstProps {
  burstKey: number;
  label?: string;
  color?: string;
  className?: string;
}

const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * Lightweight CSS-animated spark burst + floating callout for UI purchases,
 * coin rewards, and level-up feedback. Zero layout thrash, zero backdrop-filter.
 */
export const SparkBurst: React.FC<SparkBurstProps> = ({
  burstKey,
  label,
  color = '#fde047',
  className = '',
}) => {
  if (burstKey <= 0) return null;

  return (
    <span
      key={burstKey}
      aria-hidden="true"
      className={`pointer-events-none relative inline-flex items-center justify-center ${className}`}
    >
      <span
        className="neraca-ring-pulse absolute h-7 w-7 rounded-full border-2"
        style={{ borderColor: color }}
      />
      {SPARK_ANGLES.map((deg) => (
        <span
          key={deg}
          className="neraca-spark-ray absolute h-2 w-0.5 rounded-full"
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
          className="neraca-float-up font-mono-num relative z-10 whitespace-nowrap text-xs font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]"
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
