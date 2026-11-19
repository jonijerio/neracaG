import { clamp } from './physics';

export type AtmosphereStage = 'sunrise' | 'morning' | 'dusk' | 'twilight' | 'storm';

export interface AtmosphereState {
  progress: number; // 0 (calm sunrise) .. 1 (stormy night)
  stage: AtmosphereStage;
  label: string;
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  glowColor: string;
  glowAlpha: number;
  sunColor: string;
  sunOpacity: number;
  sunYNorm: number; // fraction of viewport height
  sunRadius: number;
  starAlpha: number;
  cloudTint: string;
  cloudAlpha: number;
  cloudSpeed: number;
  rainIntensity: number; // 0..1
  lightningChance: number; // flashes per second probability factor
  gridAlpha: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface AtmosphereKeyframe {
  t: number;
  skyTop: Rgb;
  skyMid: Rgb;
  skyHorizon: Rgb;
  glowColor: Rgb;
  glowAlpha: number;
  sunColor: Rgb;
  sunOpacity: number;
  sunYNorm: number;
  sunRadius: number;
  starAlpha: number;
  cloudTint: Rgb;
  cloudAlpha: number;
  cloudSpeed: number;
  rainIntensity: number;
  lightningChance: number;
  gridAlpha: number;
}

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgbString(a: Rgb, b: Rgb, t: number): string {
  const r = Math.round(lerpNum(a.r, b.r, t));
  const g = Math.round(lerpNum(a.g, b.g, t));
  const bl = Math.round(lerpNum(a.b, b.b, t));
  return `rgb(${r}, ${g}, ${bl})`;
}

const KEYFRAMES: readonly AtmosphereKeyframe[] = [
  {
    // Level 1: Calm Sunrise (dark zenith for crisp HUD legibility, warm rose/peach horizon)
    t: 0.0,
    skyTop: hexToRgb('#171f33'),
    skyMid: hexToRgb('#38304c'),
    skyHorizon: hexToRgb('#b86b52'),
    glowColor: hexToRgb('#fb923c'),
    glowAlpha: 0.34,
    sunColor: hexToRgb('#fde68a'),
    sunOpacity: 0.85,
    sunYNorm: 0.58,
    sunRadius: 42,
    starAlpha: 0.08,
    cloudTint: hexToRgb('#f5c4a1'),
    cloudAlpha: 0.18,
    cloudSpeed: 10,
    rainIntensity: 0,
    lightningChance: 0,
    gridAlpha: 0.028,
  },
  {
    // Level 2-3: Clear Morning Glow
    t: 0.28,
    skyTop: hexToRgb('#152642'),
    skyMid: hexToRgb('#27486d'),
    skyHorizon: hexToRgb('#8b654e'),
    glowColor: hexToRgb('#fbbf24'),
    glowAlpha: 0.24,
    sunColor: hexToRgb('#fef3c7'),
    sunOpacity: 0.72,
    sunYNorm: 0.4,
    sunRadius: 36,
    starAlpha: 0.0,
    cloudTint: hexToRgb('#e2e8f0'),
    cloudAlpha: 0.22,
    cloudSpeed: 16,
    rainIntensity: 0,
    lightningChance: 0,
    gridAlpha: 0.026,
  },
  {
    // Level 4-5: Amber Dusk
    t: 0.54,
    skyTop: hexToRgb('#131428'),
    skyMid: hexToRgb('#322544'),
    skyHorizon: hexToRgb('#7a3b36'),
    glowColor: hexToRgb('#f97316'),
    glowAlpha: 0.26,
    sunColor: hexToRgb('#fdba74'),
    sunOpacity: 0.48,
    sunYNorm: 0.72,
    sunRadius: 46,
    starAlpha: 0.36,
    cloudTint: hexToRgb('#7f5a6b'),
    cloudAlpha: 0.48,
    cloudSpeed: 24,
    rainIntensity: 0.1,
    lightningChance: 0,
    gridAlpha: 0.024,
  },
  {
    // Level 6-7: Gathering Twilight Storm
    t: 0.78,
    skyTop: hexToRgb('#0b101d'),
    skyMid: hexToRgb('#182235'),
    skyHorizon: hexToRgb('#243248'),
    glowColor: hexToRgb('#60a5fa'),
    glowAlpha: 0.14,
    sunColor: hexToRgb('#94a3b8'),
    sunOpacity: 0.08,
    sunYNorm: 0.88,
    sunRadius: 34,
    starAlpha: 0.58,
    cloudTint: hexToRgb('#334155'),
    cloudAlpha: 0.68,
    cloudSpeed: 38,
    rainIntensity: 0.45,
    lightningChance: 0.18,
    gridAlpha: 0.022,
  },
  {
    // Level 8+: Stormy Night
    t: 1.0,
    skyTop: hexToRgb('#070a12'),
    skyMid: hexToRgb('#101724'),
    skyHorizon: hexToRgb('#192334'),
    glowColor: hexToRgb('#38bdf8'),
    glowAlpha: 0.12,
    sunColor: hexToRgb('#64748b'),
    sunOpacity: 0,
    sunYNorm: 0.94,
    sunRadius: 30,
    starAlpha: 0.22,
    cloudTint: hexToRgb('#1e293b'),
    cloudAlpha: 0.86,
    cloudSpeed: 58,
    rainIntensity: 1.0,
    lightningChance: 0.65,
    gridAlpha: 0.02,
  },
];

export function levelToAtmosphereProgress(level: number): number {
  return clamp((Math.max(1, level) - 1) / 7, 0, 1);
}

export function getAtmosphereStageInfo(progress: number): {
  stage: AtmosphereStage;
  label: string;
} {
  const p = clamp(progress, 0, 1);
  if (p < 0.18) {
    return { stage: 'sunrise', label: 'Fajar Tenang' };
  }
  if (p < 0.42) {
    return { stage: 'morning', label: 'Pagi Cerah' };
  }
  if (p < 0.66) {
    return { stage: 'dusk', label: 'Senja Berangin' };
  }
  if (p < 0.88) {
    return { stage: 'twilight', label: 'Malam Berawan' };
  }
  return { stage: 'storm', label: 'Malam Badai' };
}

export function computeAtmosphereFromProgress(rawProgress: number): AtmosphereState {
  const p = clamp(rawProgress, 0, 1);

  let lower = KEYFRAMES[0];
  let upper = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (p >= KEYFRAMES[i].t && p <= KEYFRAMES[i + 1].t) {
      lower = KEYFRAMES[i];
      upper = KEYFRAMES[i + 1];
      break;
    }
  }

  const span = Math.max(1e-5, upper.t - lower.t);
  const localT = clamp((p - lower.t) / span, 0, 1);
  const { stage, label } = getAtmosphereStageInfo(p);

  return {
    progress: p,
    stage,
    label,
    skyTop: lerpRgbString(lower.skyTop, upper.skyTop, localT),
    skyMid: lerpRgbString(lower.skyMid, upper.skyMid, localT),
    skyHorizon: lerpRgbString(lower.skyHorizon, upper.skyHorizon, localT),
    glowColor: lerpRgbString(lower.glowColor, upper.glowColor, localT),
    glowAlpha: lerpNum(lower.glowAlpha, upper.glowAlpha, localT),
    sunColor: lerpRgbString(lower.sunColor, upper.sunColor, localT),
    sunOpacity: lerpNum(lower.sunOpacity, upper.sunOpacity, localT),
    sunYNorm: lerpNum(lower.sunYNorm, upper.sunYNorm, localT),
    sunRadius: lerpNum(lower.sunRadius, upper.sunRadius, localT),
    starAlpha: lerpNum(lower.starAlpha, upper.starAlpha, localT),
    cloudTint: lerpRgbString(lower.cloudTint, upper.cloudTint, localT),
    cloudAlpha: lerpNum(lower.cloudAlpha, upper.cloudAlpha, localT),
    cloudSpeed: lerpNum(lower.cloudSpeed, upper.cloudSpeed, localT),
    rainIntensity: lerpNum(lower.rainIntensity, upper.rainIntensity, localT),
    lightningChance: lerpNum(lower.lightningChance, upper.lightningChance, localT),
    gridAlpha: lerpNum(lower.gridAlpha, upper.gridAlpha, localT),
  };
}

export function computeAtmosphere(level: number): AtmosphereState {
  return computeAtmosphereFromProgress(levelToAtmosphereProgress(level));
}
