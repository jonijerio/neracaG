export interface ComboIndicatorStyle {
  visible: boolean;
  label: string;
  color: string;
  glowColor: string;
  tier: 'base' | 'hot' | 'blaze';
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
    };
  }

  if (safeCombo >= 6) {
    return {
      visible: true,
      label: `Combo x${safeCombo}`,
      color: '#fb923c',
      glowColor: 'rgba(251, 146, 60, 0.55)',
      tier: 'blaze',
    };
  }

  if (safeCombo >= 4) {
    return {
      visible: true,
      label: `Combo x${safeCombo}`,
      color: '#fde047',
      glowColor: 'rgba(253, 224, 71, 0.5)',
      tier: 'hot',
    };
  }

  return {
    visible: true,
    label: `Combo x${safeCombo}`,
    color: '#34d399',
    glowColor: 'rgba(52, 211, 153, 0.45)',
    tier: 'base',
  };
}

export function shouldPulseCombo(prevCombo: number, nextCombo: number): boolean {
  return nextCombo > prevCombo && nextCombo > 1;
}
