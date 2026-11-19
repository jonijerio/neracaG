export type SkinId =
  | 'classic'
  | 'cyber'
  | 'magma'
  | 'arctic'
  | 'royal'
  | 'cosmos'
  | 'emerald'
  | 'amethyst'
  | 'sakura'
  | 'steampunk'
  | 'plasma'
  | 'obsidian'
  | 'ocean'
  | 'solaris'
  | 'prism';

export type BoardPattern =
  | 'wood'
  | 'circuit'
  | 'lava'
  | 'frost'
  | 'royal'
  | 'cosmos'
  | 'leaf'
  | 'rune'
  | 'sakura'
  | 'gear'
  | 'plasma'
  | 'shadow'
  | 'wave'
  | 'solar'
  | 'prism';

export type BallPattern =
  | 'band'
  | 'circuit'
  | 'magma'
  | 'snowflake'
  | 'crown'
  | 'galaxy'
  | 'spiral'
  | 'rune'
  | 'blossom'
  | 'gear'
  | 'plasma'
  | 'eclipse'
  | 'wave'
  | 'sun'
  | 'prism';

export type TrailStyle =
  | 'smooth'
  | 'ribbon'
  | 'ember'
  | 'crystal'
  | 'lightning'
  | 'rainbow'
  | 'shadow'
  | 'bubble';

export type EffectParticleShape = 'circle' | 'spark' | 'petal' | 'diamond' | 'ring' | 'star';

export interface SkinConfig {
  id: SkinId;
  name: string;
  effectTag: string;
  board: {
    gradTop: string;
    gradMid: string;
    gradBottom: string;
    railColor: string;
    tickColor: string;
    capTop: string;
    capBottom: string;
    capRivet: string;
    collarFill: string;
    collarStroke: string;
    collarPin: string;
    glowColor: string | null;
    pattern: BoardPattern;
    accentColor: string;
  };
  fulcrum: {
    pedestalFill: string;
    pedestalStroke: string;
    baseFill: string;
    baseStroke: string;
    arcColor: string;
    needleColor: string;
    gimbalColor: string;
  };
  ball: {
    gradHighlight: string;
    gradMid: string;
    gradEdge: string;
    gradCore: string;
    rimColor: string;
    bandColor: string;
    dotColor: string;
    specularColor: string;
    pattern: BallPattern;
    auraColor: string | null;
    orbiterColor: string | null;
    orbiterCount: number;
  };
  fx: {
    trailStyle: TrailStyle;
    trailRgb: string;
    trailSecondaryRgb: string;
    particleShape: EffectParticleShape;
    particleColors: readonly [string, string, string];
    particleGravity: number;
    particleDrift: number;
    emitRate: number;
    burstColor: string;
    shockwaveColor: string;
  };
}

export const SKIN_ORDER: readonly SkinId[] = [
  'classic',
  'cyber',
  'magma',
  'arctic',
  'royal',
  'cosmos',
  'emerald',
  'amethyst',
  'sakura',
  'steampunk',
  'plasma',
  'obsidian',
  'ocean',
  'solaris',
  'prism',
];

export const SKIN_PRESETS: Record<SkinId, SkinConfig> = {
  classic: {
    id: 'classic',
    name: 'Klasik Walnut',
    effectTag: 'Kilau Emas · Debu Hangat',
    board: {
      gradTop: '#b37449',
      gradMid: '#8d5634',
      gradBottom: '#58331e',
      railColor: 'rgba(244, 210, 146, 0.34)',
      tickColor: 'rgba(244, 241, 234, 0.24)',
      capTop: '#e0b164',
      capBottom: '#8c5e21',
      capRivet: '#3b260c',
      collarFill: '#c88c32',
      collarStroke: '#6c4814',
      collarPin: '#f6d48b',
      glowColor: 'rgba(232, 155, 45, 0.14)',
      pattern: 'wood',
      accentColor: '#e89b2d',
    },
    fulcrum: {
      pedestalFill: '#252d37',
      pedestalStroke: '#3e4a59',
      baseFill: '#1b222a',
      baseStroke: '#475569',
      arcColor: 'rgba(218, 174, 102, 0.2)',
      needleColor: '#e89b2d',
      gimbalColor: '#d89b3c',
    },
    ball: {
      gradHighlight: '#fdfbf7',
      gradMid: '#d9d3c7',
      gradEdge: '#7a828c',
      gradCore: '#313740',
      rimColor: 'rgba(255, 255, 255, 0.28)',
      bandColor: 'rgba(180, 120, 42, 0.65)',
      dotColor: 'rgba(212, 152, 62, 0.85)',
      specularColor: 'rgba(255, 255, 255, 0.78)',
      pattern: 'band',
      auraColor: 'rgba(245, 196, 105, 0.24)',
      orbiterColor: null,
      orbiterCount: 0,
    },
    fx: {
      trailStyle: 'smooth',
      trailRgb: '245, 196, 105',
      trailSecondaryRgb: '226, 232, 240',
      particleShape: 'circle',
      particleColors: ['#f5c469', '#fde68a', '#d89b3c'],
      particleGravity: -18,
      particleDrift: 24,
      emitRate: 7,
      burstColor: '#f5c469',
      shockwaveColor: '#f5c469',
    },
  },

  cyber: {
    id: 'cyber',
    name: 'Neon Siber',
    effectTag: 'Jejak Laser · Sirkuit',
    board: {
      gradTop: '#16293d',
      gradMid: '#0d1926',
      gradBottom: '#070d15',
      railColor: 'rgba(34, 211, 238, 0.72)',
      tickColor: 'rgba(56, 189, 248, 0.45)',
      capTop: '#22d3ee',
      capBottom: '#0e7490',
      capRivet: '#f472b6',
      collarFill: '#0f172a',
      collarStroke: '#22d3ee',
      collarPin: '#f472b6',
      glowColor: 'rgba(34, 211, 238, 0.32)',
      pattern: 'circuit',
      accentColor: '#22d3ee',
    },
    fulcrum: {
      pedestalFill: '#0f172a',
      pedestalStroke: '#0891b2',
      baseFill: '#090e17',
      baseStroke: '#22d3ee',
      arcColor: 'rgba(34, 211, 238, 0.34)',
      needleColor: '#f472b6',
      gimbalColor: '#22d3ee',
    },
    ball: {
      gradHighlight: '#cffafe',
      gradMid: '#22d3ee',
      gradEdge: '#0e7490',
      gradCore: '#082f49',
      rimColor: '#67e8f9',
      bandColor: '#f472b6',
      dotColor: '#a5f3fc',
      specularColor: 'rgba(255, 255, 255, 0.85)',
      pattern: 'circuit',
      auraColor: 'rgba(34, 211, 238, 0.45)',
      orbiterColor: '#f472b6',
      orbiterCount: 2,
    },
    fx: {
      trailStyle: 'ribbon',
      trailRgb: '34, 211, 238',
      trailSecondaryRgb: '244, 114, 182',
      particleShape: 'spark',
      particleColors: ['#22d3ee', '#f472b6', '#a5f3fc'],
      particleGravity: 0,
      particleDrift: 48,
      emitRate: 13,
      burstColor: '#22d3ee',
      shockwaveColor: '#f472b6',
    },
  },

  magma: {
    id: 'magma',
    name: 'Magma Vulkanik',
    effectTag: 'Bara Api · Retak Lava',
    board: {
      gradTop: '#3c2420',
      gradMid: '#241412',
      gradBottom: '#130908',
      railColor: 'rgba(251, 146, 60, 0.72)',
      tickColor: 'rgba(249, 115, 22, 0.42)',
      capTop: '#fb923c',
      capBottom: '#9a3412',
      capRivet: '#fef08a',
      collarFill: '#7c2d12',
      collarStroke: '#fb923c',
      collarPin: '#fde047',
      glowColor: 'rgba(249, 115, 22, 0.36)',
      pattern: 'lava',
      accentColor: '#f97316',
    },
    fulcrum: {
      pedestalFill: '#211311',
      pedestalStroke: '#9a3412',
      baseFill: '#140b0a',
      baseStroke: '#ea580c',
      arcColor: 'rgba(251, 146, 60, 0.28)',
      needleColor: '#fb923c',
      gimbalColor: '#f97316',
    },
    ball: {
      gradHighlight: '#fef08a',
      gradMid: '#f97316',
      gradEdge: '#991b1b',
      gradCore: '#2a0808',
      rimColor: '#fb923c',
      bandColor: '#fde047',
      dotColor: '#fed7aa',
      specularColor: 'rgba(254, 240, 138, 0.85)',
      pattern: 'magma',
      auraColor: 'rgba(249, 115, 22, 0.48)',
      orbiterColor: '#fde047',
      orbiterCount: 3,
    },
    fx: {
      trailStyle: 'ember',
      trailRgb: '249, 115, 22',
      trailSecondaryRgb: '253, 224, 71',
      particleShape: 'spark',
      particleColors: ['#fb923c', '#fde047', '#ef4444'],
      particleGravity: -95,
      particleDrift: 40,
      emitRate: 16,
      burstColor: '#fb923c',
      shockwaveColor: '#fde047',
    },
  },

  arctic: {
    id: 'arctic',
    name: 'Es Arktik',
    effectTag: 'Salju Kristal · Beku',
    board: {
      gradTop: '#bae6fd',
      gradMid: '#38bdf8',
      gradBottom: '#0369a1',
      railColor: 'rgba(240, 249, 255, 0.78)',
      tickColor: 'rgba(224, 242, 254, 0.55)',
      capTop: '#e0f2fe',
      capBottom: '#0284c7',
      capRivet: '#ffffff',
      collarFill: '#0ea5e9',
      collarStroke: '#e0f2fe',
      collarPin: '#ffffff',
      glowColor: 'rgba(125, 211, 252, 0.34)',
      pattern: 'frost',
      accentColor: '#7dd3fc',
    },
    fulcrum: {
      pedestalFill: '#172c3f',
      pedestalStroke: '#7dd3fc',
      baseFill: '#0f1f2e',
      baseStroke: '#38bdf8',
      arcColor: 'rgba(186, 230, 253, 0.32)',
      needleColor: '#e0f2fe',
      gimbalColor: '#7dd3fc',
    },
    ball: {
      gradHighlight: '#ffffff',
      gradMid: '#bae6fd',
      gradEdge: '#38bdf8',
      gradCore: '#075985',
      rimColor: '#e0f2fe',
      bandColor: 'rgba(255, 255, 255, 0.85)',
      dotColor: '#e0f2fe',
      specularColor: 'rgba(255, 255, 255, 0.92)',
      pattern: 'snowflake',
      auraColor: 'rgba(186, 230, 253, 0.45)',
      orbiterColor: '#e0f2fe',
      orbiterCount: 2,
    },
    fx: {
      trailStyle: 'crystal',
      trailRgb: '186, 230, 253',
      trailSecondaryRgb: '255, 255, 255',
      particleShape: 'diamond',
      particleColors: ['#e0f2fe', '#7dd3fc', '#ffffff'],
      particleGravity: 34,
      particleDrift: 32,
      emitRate: 14,
      burstColor: '#bae6fd',
      shockwaveColor: '#e0f2fe',
    },
  },

  royal: {
    id: 'royal',
    name: 'Emas Kerajaan',
    effectTag: 'Mahkota Emas · Kilau',
    board: {
      gradTop: '#fde047',
      gradMid: '#ca8a04',
      gradBottom: '#713f12',
      railColor: 'rgba(254, 249, 195, 0.72)',
      tickColor: 'rgba(127, 29, 29, 0.52)',
      capTop: '#dc2626',
      capBottom: '#7f1d1d',
      capRivet: '#fde047',
      collarFill: '#991b1b',
      collarStroke: '#fde047',
      collarPin: '#fef08a',
      glowColor: 'rgba(250, 204, 21, 0.3)',
      pattern: 'royal',
      accentColor: '#facc15',
    },
    fulcrum: {
      pedestalFill: '#291a16',
      pedestalStroke: '#eab308',
      baseFill: '#1c110e',
      baseStroke: '#ca8a04',
      arcColor: 'rgba(250, 204, 21, 0.34)',
      needleColor: '#fde047',
      gimbalColor: '#facc15',
    },
    ball: {
      gradHighlight: '#fef9c3',
      gradMid: '#facc15',
      gradEdge: '#b45309',
      gradCore: '#451a03',
      rimColor: '#fef08a',
      bandColor: '#dc2626',
      dotColor: '#fef08a',
      specularColor: 'rgba(255, 255, 255, 0.88)',
      pattern: 'crown',
      auraColor: 'rgba(250, 204, 21, 0.45)',
      orbiterColor: '#fef08a',
      orbiterCount: 3,
    },
    fx: {
      trailStyle: 'smooth',
      trailRgb: '250, 204, 21',
      trailSecondaryRgb: '248, 113, 113',
      particleShape: 'star',
      particleColors: ['#fde047', '#facc15', '#fca5a5'],
      particleGravity: -22,
      particleDrift: 30,
      emitRate: 13,
      burstColor: '#fde047',
      shockwaveColor: '#facc15',
    },
  },

  cosmos: {
    id: 'cosmos',
    name: 'Kosmos Nebula',
    effectTag: 'Bintang · Orbit Galaksi',
    board: {
      gradTop: '#312e81',
      gradMid: '#1e1b4b',
      gradBottom: '#09071a',
      railColor: 'rgba(192, 132, 252, 0.62)',
      tickColor: 'rgba(165, 180, 252, 0.4)',
      capTop: '#a855f7',
      capBottom: '#4c1d95',
      capRivet: '#f0abfc',
      collarFill: '#3b0764',
      collarStroke: '#c084fc',
      collarPin: '#e9d5ff',
      glowColor: 'rgba(168, 85, 247, 0.32)',
      pattern: 'cosmos',
      accentColor: '#c084fc',
    },
    fulcrum: {
      pedestalFill: '#141132',
      pedestalStroke: '#818cf8',
      baseFill: '#0b091e',
      baseStroke: '#a855f7',
      arcColor: 'rgba(192, 132, 252, 0.3)',
      needleColor: '#e879f9',
      gimbalColor: '#c084fc',
    },
    ball: {
      gradHighlight: '#f5d0fe',
      gradMid: '#818cf8',
      gradEdge: '#4338ca',
      gradCore: '#0f0729',
      rimColor: '#c084fc',
      bandColor: '#f0abfc',
      dotColor: '#fde68a',
      specularColor: 'rgba(255, 255, 255, 0.84)',
      pattern: 'galaxy',
      auraColor: 'rgba(192, 132, 252, 0.45)',
      orbiterColor: '#e9d5ff',
      orbiterCount: 4,
    },
    fx: {
      trailStyle: 'smooth',
      trailRgb: '192, 132, 252',
      trailSecondaryRgb: '129, 140, 248',
      particleShape: 'star',
      particleColors: ['#e879f9', '#818cf8', '#fde68a'],
      particleGravity: -12,
      particleDrift: 35,
      emitRate: 15,
      burstColor: '#c084fc',
      shockwaveColor: '#818cf8',
    },
  },

  emerald: {
    id: 'emerald',
    name: 'Zamrud Hutan',
    effectTag: 'Kunang · Daun Zamrud',
    board: {
      gradTop: '#3f6212',
      gradMid: '#166534',
      gradBottom: '#052e16',
      railColor: 'rgba(110, 231, 183, 0.56)',
      tickColor: 'rgba(167, 243, 208, 0.38)',
      capTop: '#34d399',
      capBottom: '#047857',
      capRivet: '#fef08a',
      collarFill: '#065f46',
      collarStroke: '#34d399',
      collarPin: '#a7f3d0',
      glowColor: 'rgba(52, 211, 153, 0.25)',
      pattern: 'leaf',
      accentColor: '#34d399',
    },
    fulcrum: {
      pedestalFill: '#11261c',
      pedestalStroke: '#10b981',
      baseFill: '#0a1912',
      baseStroke: '#059669',
      arcColor: 'rgba(52, 211, 153, 0.26)',
      needleColor: '#6ee7b7',
      gimbalColor: '#34d399',
    },
    ball: {
      gradHighlight: '#ecfdf5',
      gradMid: '#34d399',
      gradEdge: '#047857',
      gradCore: '#022c22',
      rimColor: '#6ee7b7',
      bandColor: '#bef264',
      dotColor: '#fef08a',
      specularColor: 'rgba(255, 255, 255, 0.82)',
      pattern: 'spiral',
      auraColor: 'rgba(52, 211, 153, 0.42)',
      orbiterColor: '#bef264',
      orbiterCount: 2,
    },
    fx: {
      trailStyle: 'smooth',
      trailRgb: '52, 211, 153',
      trailSecondaryRgb: '190, 242, 100',
      particleShape: 'circle',
      particleColors: ['#34d399', '#bef264', '#a7f3d0'],
      particleGravity: -28,
      particleDrift: 46,
      emitRate: 13,
      burstColor: '#34d399',
      shockwaveColor: '#6ee7b7',
    },
  },

  amethyst: {
    id: 'amethyst',
    name: 'Ametis Mistis',
    effectTag: 'Rune Sihir · Aura Ungu',
    board: {
      gradTop: '#6b21a8',
      gradMid: '#4c1d95',
      gradBottom: '#2e1065',
      railColor: 'rgba(232, 121, 249, 0.6)',
      tickColor: 'rgba(245, 208, 254, 0.4)',
      capTop: '#d946ef',
      capBottom: '#701a75',
      capRivet: '#f5d0fe',
      collarFill: '#581c87',
      collarStroke: '#e879f9',
      collarPin: '#fae8ff',
      glowColor: 'rgba(217, 70, 239, 0.3)',
      pattern: 'rune',
      accentColor: '#d946ef',
    },
    fulcrum: {
      pedestalFill: '#1f1035',
      pedestalStroke: '#a855f7',
      baseFill: '#130922',
      baseStroke: '#c084fc',
      arcColor: 'rgba(217, 70, 239, 0.3)',
      needleColor: '#f0abfc',
      gimbalColor: '#d946ef',
    },
    ball: {
      gradHighlight: '#fae8ff',
      gradMid: '#d946ef',
      gradEdge: '#7e22ce',
      gradCore: '#2e1065',
      rimColor: '#f0abfc',
      bandColor: '#f5d0fe',
      dotColor: '#c084fc',
      specularColor: 'rgba(255, 255, 255, 0.85)',
      pattern: 'rune',
      auraColor: 'rgba(217, 70, 239, 0.48)',
      orbiterColor: '#f5d0fe',
      orbiterCount: 3,
    },
    fx: {
      trailStyle: 'crystal',
      trailRgb: '217, 70, 239',
      trailSecondaryRgb: '168, 85, 247',
      particleShape: 'diamond',
      particleColors: ['#e879f9', '#c084fc', '#fae8ff'],
      particleGravity: -24,
      particleDrift: 38,
      emitRate: 14,
      burstColor: '#e879f9',
      shockwaveColor: '#d946ef',
    },
  },

  sakura: {
    id: 'sakura',
    name: 'Sakura Zen',
    effectTag: 'Kelopak Bunga · Halus',
    board: {
      gradTop: '#f3d5b5',
      gradMid: '#d4a373',
      gradBottom: '#8c5a3c',
      railColor: 'rgba(251, 113, 133, 0.65)',
      tickColor: 'rgba(136, 19, 55, 0.35)',
      capTop: '#fb7185',
      capBottom: '#be123c',
      capRivet: '#fff1f2',
      collarFill: '#9f1239',
      collarStroke: '#fda4af',
      collarPin: '#ffe4e6',
      glowColor: 'rgba(251, 113, 133, 0.24)',
      pattern: 'sakura',
      accentColor: '#fb7185',
    },
    fulcrum: {
      pedestalFill: '#2a1c22',
      pedestalStroke: '#fb7185',
      baseFill: '#1a1115',
      baseStroke: '#f43f5e',
      arcColor: 'rgba(253, 164, 175, 0.28)',
      needleColor: '#fda4af',
      gimbalColor: '#fb7185',
    },
    ball: {
      gradHighlight: '#fff1f2',
      gradMid: '#fecdd3',
      gradEdge: '#fb7185',
      gradCore: '#881337',
      rimColor: '#fda4af',
      bandColor: '#f43f5e',
      dotColor: '#ffe4e6',
      specularColor: 'rgba(255, 255, 255, 0.9)',
      pattern: 'blossom',
      auraColor: 'rgba(253, 164, 175, 0.42)',
      orbiterColor: '#fecdd3',
      orbiterCount: 2,
    },
    fx: {
      trailStyle: 'smooth',
      trailRgb: '253, 164, 175',
      trailSecondaryRgb: '255, 241, 242',
      particleShape: 'petal',
      particleColors: ['#fda4af', '#fecdd3', '#fb7185'],
      particleGravity: 28,
      particleDrift: 54,
      emitRate: 14,
      burstColor: '#fda4af',
      shockwaveColor: '#fb7185',
    },
  },

  steampunk: {
    id: 'steampunk',
    name: 'Steampunk Perunggu',
    effectTag: 'Uap Mesin · Roda Gigi',
    board: {
      gradTop: '#cd7f32',
      gradMid: '#92400e',
      gradBottom: '#451a03',
      railColor: 'rgba(253, 186, 116, 0.5)',
      tickColor: 'rgba(254, 215, 170, 0.45)',
      capTop: '#94a3b8',
      capBottom: '#334155',
      capRivet: '#f59e0b',
      collarFill: '#78350f',
      collarStroke: '#fbbf24',
      collarPin: '#cbd5e1',
      glowColor: 'rgba(245, 158, 11, 0.22)',
      pattern: 'gear',
      accentColor: '#f59e0b',
    },
    fulcrum: {
      pedestalFill: '#292018',
      pedestalStroke: '#b45309',
      baseFill: '#1a140f',
      baseStroke: '#d97706',
      arcColor: 'rgba(245, 158, 11, 0.32)',
      needleColor: '#fbbf24',
      gimbalColor: '#d97706',
    },
    ball: {
      gradHighlight: '#fef3c7',
      gradMid: '#d97706',
      gradEdge: '#78350f',
      gradCore: '#291507',
      rimColor: '#fbbf24',
      bandColor: '#475569',
      dotColor: '#fde68a',
      specularColor: 'rgba(255, 255, 255, 0.78)',
      pattern: 'gear',
      auraColor: 'rgba(245, 158, 11, 0.34)',
      orbiterColor: '#cbd5e1',
      orbiterCount: 2,
    },
    fx: {
      trailStyle: 'ember',
      trailRgb: '226, 232, 240',
      trailSecondaryRgb: '245, 158, 11',
      particleShape: 'ring',
      particleColors: ['#e2e8f0', '#fbbf24', '#cbd5e1'],
      particleGravity: -58,
      particleDrift: 26,
      emitRate: 12,
      burstColor: '#fbbf24',
      shockwaveColor: '#f59e0b',
    },
  },

  plasma: {
    id: 'plasma',
    name: 'Petir Plasma',
    effectTag: 'Busur Petir · Tegangan',
    board: {
      gradTop: '#1d4ed8',
      gradMid: '#1e293b',
      gradBottom: '#090d16',
      railColor: 'rgba(96, 165, 250, 0.78)',
      tickColor: 'rgba(147, 197, 253, 0.45)',
      capTop: '#60a5fa',
      capBottom: '#1d4ed8',
      capRivet: '#fef08a',
      collarFill: '#1e3a8a',
      collarStroke: '#93c5fd',
      collarPin: '#fef08a',
      glowColor: 'rgba(59, 130, 246, 0.4)',
      pattern: 'plasma',
      accentColor: '#60a5fa',
    },
    fulcrum: {
      pedestalFill: '#0f172a',
      pedestalStroke: '#3b82f6',
      baseFill: '#080d1a',
      baseStroke: '#60a5fa',
      arcColor: 'rgba(96, 165, 250, 0.35)',
      needleColor: '#fef08a',
      gimbalColor: '#60a5fa',
    },
    ball: {
      gradHighlight: '#ffffff',
      gradMid: '#60a5fa',
      gradEdge: '#1d4ed8',
      gradCore: '#0f172a',
      rimColor: '#93c5fd',
      bandColor: '#fef08a',
      dotColor: '#ffffff',
      specularColor: 'rgba(255, 255, 255, 0.92)',
      pattern: 'plasma',
      auraColor: 'rgba(96, 165, 250, 0.56)',
      orbiterColor: '#fef08a',
      orbiterCount: 3,
    },
    fx: {
      trailStyle: 'lightning',
      trailRgb: '96, 165, 250',
      trailSecondaryRgb: '254, 240, 138',
      particleShape: 'spark',
      particleColors: ['#93c5fd', '#fef08a', '#3b82f6'],
      particleGravity: 0,
      particleDrift: 72,
      emitRate: 17,
      burstColor: '#60a5fa',
      shockwaveColor: '#fef08a',
    },
  },

  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Bayangan',
    effectTag: 'Gerhana · Asap Merah',
    board: {
      gradTop: '#27272a',
      gradMid: '#18181b',
      gradBottom: '#09090b',
      railColor: 'rgba(244, 63, 94, 0.72)',
      tickColor: 'rgba(244, 63, 94, 0.38)',
      capTop: '#e11d48',
      capBottom: '#881337',
      capRivet: '#fda4af',
      collarFill: '#18181b',
      collarStroke: '#f43f5e',
      collarPin: '#fb7185',
      glowColor: 'rgba(225, 29, 72, 0.3)',
      pattern: 'shadow',
      accentColor: '#f43f5e',
    },
    fulcrum: {
      pedestalFill: '#121215',
      pedestalStroke: '#be123c',
      baseFill: '#09090b',
      baseStroke: '#e11d48',
      arcColor: 'rgba(244, 63, 94, 0.28)',
      needleColor: '#fb7185',
      gimbalColor: '#e11d48',
    },
    ball: {
      gradHighlight: '#52525b',
      gradMid: '#27272a',
      gradEdge: '#09090b',
      gradCore: '#000000',
      rimColor: '#f43f5e',
      bandColor: '#fb7185',
      dotColor: '#ffe4e6',
      specularColor: 'rgba(253, 164, 175, 0.65)',
      pattern: 'eclipse',
      auraColor: 'rgba(244, 63, 94, 0.5)',
      orbiterColor: '#fb7185',
      orbiterCount: 2,
    },
    fx: {
      trailStyle: 'shadow',
      trailRgb: '24, 24, 27',
      trailSecondaryRgb: '244, 63, 94',
      particleShape: 'circle',
      particleColors: ['#f43f5e', '#27272a', '#fb7185'],
      particleGravity: -34,
      particleDrift: 32,
      emitRate: 14,
      burstColor: '#f43f5e',
      shockwaveColor: '#fb7185',
    },
  },

  ocean: {
    id: 'ocean',
    name: 'Samudra Karang',
    effectTag: 'Gelembung · Mutiara Laut',
    board: {
      gradTop: '#14b8a6',
      gradMid: '#0f766e',
      gradBottom: '#134e4a',
      railColor: 'rgba(153, 246, 228, 0.68)',
      tickColor: 'rgba(204, 251, 241, 0.42)',
      capTop: '#fb7185',
      capBottom: '#e11d48',
      capRivet: '#ccfbf1',
      collarFill: '#115e59',
      collarStroke: '#5eead4',
      collarPin: '#f0fdfa',
      glowColor: 'rgba(20, 184, 166, 0.28)',
      pattern: 'wave',
      accentColor: '#2dd4bf',
    },
    fulcrum: {
      pedestalFill: '#0e292b',
      pedestalStroke: '#14b8a6',
      baseFill: '#081b1d',
      baseStroke: '#2dd4bf',
      arcColor: 'rgba(94, 234, 212, 0.28)',
      needleColor: '#5eead4',
      gimbalColor: '#2dd4bf',
    },
    ball: {
      gradHighlight: '#f0fdfa',
      gradMid: '#5eead4',
      gradEdge: '#0d9488',
      gradCore: '#115e59',
      rimColor: '#99f6e4',
      bandColor: '#fb7185',
      dotColor: '#f0fdfa',
      specularColor: 'rgba(255, 255, 255, 0.9)',
      pattern: 'wave',
      auraColor: 'rgba(45, 212, 191, 0.42)',
      orbiterColor: '#99f6e4',
      orbiterCount: 2,
    },
    fx: {
      trailStyle: 'bubble',
      trailRgb: '94, 234, 212',
      trailSecondaryRgb: '240, 253, 250',
      particleShape: 'ring',
      particleColors: ['#99f6e4', '#5eead4', '#f0fdfa'],
      particleGravity: -62,
      particleDrift: 28,
      emitRate: 13,
      burstColor: '#2dd4bf',
      shockwaveColor: '#99f6e4',
    },
  },

  solaris: {
    id: 'solaris',
    name: 'Solaris Fajar',
    effectTag: 'Suar Surya · Cahaya',
    board: {
      gradTop: '#fbbf24',
      gradMid: '#d97706',
      gradBottom: '#78350f',
      railColor: 'rgba(254, 243, 199, 0.8)',
      tickColor: 'rgba(255, 251, 235, 0.48)',
      capTop: '#f59e0b',
      capBottom: '#b45309',
      capRivet: '#fffbeb',
      collarFill: '#b45309',
      collarStroke: '#fde68a',
      collarPin: '#ffffff',
      glowColor: 'rgba(251, 191, 36, 0.36)',
      pattern: 'solar',
      accentColor: '#fbbf24',
    },
    fulcrum: {
      pedestalFill: '#291c0d',
      pedestalStroke: '#f59e0b',
      baseFill: '#1a1107',
      baseStroke: '#fbbf24',
      arcColor: 'rgba(253, 224, 71, 0.34)',
      needleColor: '#fef08a',
      gimbalColor: '#fbbf24',
    },
    ball: {
      gradHighlight: '#ffffff',
      gradMid: '#fde047',
      gradEdge: '#f59e0b',
      gradCore: '#c2410c',
      rimColor: '#fef08a',
      bandColor: '#fb923c',
      dotColor: '#ffffff',
      specularColor: 'rgba(255, 255, 255, 0.95)',
      pattern: 'sun',
      auraColor: 'rgba(251, 191, 36, 0.56)',
      orbiterColor: '#fef08a',
      orbiterCount: 4,
    },
    fx: {
      trailStyle: 'ribbon',
      trailRgb: '251, 191, 36',
      trailSecondaryRgb: '251, 146, 60',
      particleShape: 'star',
      particleColors: ['#fef08a', '#fbbf24', '#fb923c'],
      particleGravity: -38,
      particleDrift: 34,
      emitRate: 15,
      burstColor: '#fbbf24',
      shockwaveColor: '#fef08a',
    },
  },

  prism: {
    id: 'prism',
    name: 'Pelangi Prisma',
    effectTag: 'Jejak Pelangi · Berlian',
    board: {
      gradTop: '#f8fafc',
      gradMid: '#94a3b8',
      gradBottom: '#334155',
      railColor: 'rgba(255, 255, 255, 0.85)',
      tickColor: 'rgba(15, 23, 42, 0.35)',
      capTop: '#e879f9',
      capBottom: '#38bdf8',
      capRivet: '#ffffff',
      collarFill: '#1e293b',
      collarStroke: '#f8fafc',
      collarPin: '#f472b6',
      glowColor: 'rgba(244, 114, 182, 0.3)',
      pattern: 'prism',
      accentColor: '#f472b6',
    },
    fulcrum: {
      pedestalFill: '#1e293b',
      pedestalStroke: '#e2e8f0',
      baseFill: '#0f172a',
      baseStroke: '#38bdf8',
      arcColor: 'rgba(248, 250, 252, 0.35)',
      needleColor: '#38bdf8',
      gimbalColor: '#f472b6',
    },
    ball: {
      gradHighlight: '#ffffff',
      gradMid: '#e0f2fe',
      gradEdge: '#c084fc',
      gradCore: '#1e1b4b',
      rimColor: '#ffffff',
      bandColor: '#f472b6',
      dotColor: '#38bdf8',
      specularColor: 'rgba(255, 255, 255, 0.96)',
      pattern: 'prism',
      auraColor: 'rgba(192, 132, 252, 0.46)',
      orbiterColor: '#67e8f9',
      orbiterCount: 3,
    },
    fx: {
      trailStyle: 'rainbow',
      trailRgb: '244, 114, 182',
      trailSecondaryRgb: '56, 189, 248',
      particleShape: 'diamond',
      particleColors: ['#f472b6', '#38bdf8', '#fde047'],
      particleGravity: -20,
      particleDrift: 44,
      emitRate: 16,
      burstColor: '#38bdf8',
      shockwaveColor: '#f472b6',
    },
  },
};

export function getSkinConfig(skinId: SkinId): SkinConfig {
  return SKIN_PRESETS[skinId] ?? SKIN_PRESETS.classic;
}
