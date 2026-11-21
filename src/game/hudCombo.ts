export interface ComboIndicatorStyle {
  visible: boolean;
  label: string;
  color: string;
  glowColor: string;
  tier: 'base' | 'hot' | 'blaze';
  auraOpacity: number;
  auraGradient: string;
}

export function getComboIndicatorStyle(combo: number): ComboIndicatorStyle {
  const safeCombo = Math.max(1, Math.round(combo));
  if (safeCombo <= 1) {
    return {
      visible: false,
      label: 'Combo x1',
      color: '#34d399',
      glowColor: 'rgba(52, 211, 153, 0.45)',
      tier: 'base',
      auraOpacity: 0,
      auraGradient: 'none',
    };
  }

  if (safeCombo >= 6) {
    return {
      visible: true,
      label: `Combo x${safeCombo}`,
      color: '#fb923c',
      glowColor: 'rgba(251, 146, 60, 0.65)',
      tier: 'blaze',
      auraOpacity: 0.9,
      auraGradient:
        'radial-gradient(ellipse at 50% 0%, rgba(251, 146, 60, 0.24) 0%, rgba(249, 115, 22, 0.08) 48%, rgba(0, 0, 0, 0) 78%)',
    };
  }

  if (safeCombo >= 4) {
    return {
      visible: true,
      label: `Combo x${safeCombo}`,
      color: '#fde047',
      glowColor: 'rgba(253, 224, 71, 0.58)',
      tier: 'hot',
      auraOpacity: 0.72,
      auraGradient:
        'radial-gradient(ellipse at 50% 0%, rgba(253, 224, 71, 0.2) 0%, rgba(234, 179, 8, 0.06) 48%, rgba(0, 0, 0, 0) 76%)',
    };
  }

  return {
    visible: true,
    label: `Combo x${safeCombo}`,
    color: '#34d399',
    glowColor: 'rgba(52, 211, 153, 0.45)',
    tier: 'base',
    auraOpacity: safeCombo >= 3 ? 0.55 : 0,
    auraGradient:
      safeCombo >= 3
        ? 'radial-gradient(ellipse at 50% 0%, rgba(52, 211, 153, 0.16) 0%, rgba(16, 185, 129, 0.04) 48%, rgba(0, 0, 0, 0) 74%)'
        : 'none',
  };
}

export function shouldPulseCombo(prevCombo: number, nextCombo: number): boolean {
  return nextCombo > prevCombo && nextCombo > 1;
}
