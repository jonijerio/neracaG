import { clamp } from './physics';

export interface GyroSample {
  gamma: number | null; // left/right tilt in portrait (-90..90)
  beta: number | null;  // front/back tilt (-180..180), used in landscape
  orientationAngle?: number; // 0, 90, -90, 180, 270
}

/**
 * Normalizes device orientation sensor readings into a smooth -1..1 tilt input
 * across both portrait and landscape orientations on phones and tablets.
 */
export function computeGyroTiltInput(
  sample: GyroSample,
  isLandscapeViewport: boolean,
  neutralOffsetDeg = 0
): number {
  const angle = ((sample.orientationAngle ?? 0) % 360 + 360) % 360;
  let rawDeg = 0;

  if (isLandscapeViewport || angle === 90 || angle === 270) {
    if (sample.beta === null || !Number.isFinite(sample.beta)) return 0;
    // At 90deg (left side down), tilting right increases beta; at 270deg, invert sign
    const sign = angle === 270 ? -1 : 1;
    rawDeg = sample.beta * sign;
  } else {
    if (sample.gamma === null || !Number.isFinite(sample.gamma)) return 0;
    const sign = angle === 180 ? -1 : 1;
    rawDeg = sample.gamma * sign;
  }

  const adjusted = rawDeg - neutralOffsetDeg;
  const deadzoneDeg = 3.5;
  const maxTiltDeg = 28;

  if (Math.abs(adjusted) <= deadzoneDeg) {
    return 0;
  }

  const effective = Math.sign(adjusted) * (Math.abs(adjusted) - deadzoneDeg);
  return clamp(effective / (maxTiltDeg - deadzoneDeg), -1, 1);
}

/**
 * Determines whether the viewport should use side-by-side wide layout
 * (desktops, tablets, and landscape phones) vs stacked portrait layout.
 */
export function isWideTitleLayout(width: number, height: number): boolean {
  return width >= 900 || (width >= 560 && width > height * 1.25);
}
