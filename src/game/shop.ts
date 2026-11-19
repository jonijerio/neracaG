import { SKIN_ORDER, SKIN_PRESETS, SkinId } from './skins';
import { DifficultyLevel } from './types';

export type ShopConsumableId = 'edge_shield' | 'start_stabilizer';
export type ShopUpgradeId = 'target_boost' | 'coin_multiplier';

export interface ShopConsumableItem {
  id: ShopConsumableId;
  name: string;
  description: string;
  price: number;
  maxStock: number;
}

export interface ShopUpgradeItem {
  id: ShopUpgradeId;
  name: string;
  description: string;
  prices: readonly [number, number, number]; // Lv 1, Lv 2, Lv 3
  maxLevel: number;
}

export interface ShopSaveState {
  coins: number;
  unlockedSkins: SkinId[];
  consumables: Record<ShopConsumableId, number>;
  upgrades: Record<ShopUpgradeId, number>;
  totalCoinsEarnedAllTime: number;
}

export const STARTER_COINS = 100;

export const SKIN_PRICES: Record<SkinId, number> = {
  classic: 0,
  emerald: 100,
  sakura: 100,
  ocean: 150,
  arctic: 150,
  cyber: 220,
  steampunk: 220,
  magma: 300,
  amethyst: 300,
  royal: 400,
  obsidian: 400,
  plasma: 500,
  cosmos: 500,
  solaris: 650,
  prism: 650,
};

export const SHOP_CONSUMABLES: Record<ShopConsumableId, ShopConsumableItem> = {
  edge_shield: {
    id: 'edge_shield',
    name: 'Perisai Tepi',
    description: 'Menyelamatkan bola 1 kali saat hampir jatuh melewati ujung papan',
    price: 120,
    maxStock: 3,
  },
  start_stabilizer: {
    id: 'start_stabilizer',
    name: 'Bekal Stabilizer',
    description: 'Memulai permainan berikutnya dengan power-up Stabilizer aktif',
    price: 80,
    maxStock: 3,
  },
};

export const SHOP_CONSUMABLE_ORDER: readonly ShopConsumableId[] = [
  'edge_shield',
  'start_stabilizer',
];

export const SHOP_UPGRADES: Record<ShopUpgradeId, ShopUpgradeItem> = {
  target_boost: {
    id: 'target_boost',
    name: 'Magnet Target',
    description: 'Mempercepat pengisian zona target +10% per level (maks +30%)',
    prices: [200, 380, 600],
    maxLevel: 3,
  },
  coin_multiplier: {
    id: 'coin_multiplier',
    name: 'Pengganda Koin',
    description: 'Menambah koin kemenangan +25% per level (maks +75%)',
    prices: [250, 450, 700],
    maxLevel: 3,
  },
};

export const SHOP_UPGRADE_ORDER: readonly ShopUpgradeId[] = [
  'target_boost',
  'coin_multiplier',
];

const SHOP_STORAGE_KEY = 'neraca_shop_v1';

export function createInitialShopState(): ShopSaveState {
  return {
    coins: STARTER_COINS,
    unlockedSkins: ['classic'],
    consumables: {
      edge_shield: 0,
      start_stabilizer: 0,
    },
    upgrades: {
      target_boost: 0,
      coin_multiplier: 0,
    },
    totalCoinsEarnedAllTime: 0,
  };
}

export function normalizeShopState(raw: Partial<ShopSaveState> | null | undefined): ShopSaveState {
  const base = createInitialShopState();
  if (!raw || typeof raw !== 'object') return base;

  const coins =
    typeof raw.coins === 'number' && Number.isFinite(raw.coins)
      ? Math.max(0, Math.floor(raw.coins))
      : base.coins;

  const totalCoinsEarnedAllTime =
    typeof raw.totalCoinsEarnedAllTime === 'number' && Number.isFinite(raw.totalCoinsEarnedAllTime)
      ? Math.max(0, Math.floor(raw.totalCoinsEarnedAllTime))
      : 0;

  const unlockedSet = new Set<SkinId>(['classic']);
  if (Array.isArray(raw.unlockedSkins)) {
    for (const s of raw.unlockedSkins) {
      if (typeof s === 'string' && s in SKIN_PRESETS) {
        unlockedSet.add(s as SkinId);
      }
    }
  }

  const clampInt = (val: unknown, max: number): number =>
    typeof val === 'number' && Number.isFinite(val) ? Math.max(0, Math.min(max, Math.floor(val))) : 0;

  return {
    coins,
    unlockedSkins: SKIN_ORDER.filter((id) => unlockedSet.has(id)),
    consumables: {
      edge_shield: clampInt(raw.consumables?.edge_shield, SHOP_CONSUMABLES.edge_shield.maxStock),
      start_stabilizer: clampInt(
        raw.consumables?.start_stabilizer,
        SHOP_CONSUMABLES.start_stabilizer.maxStock
      ),
    },
    upgrades: {
      target_boost: clampInt(raw.upgrades?.target_boost, SHOP_UPGRADES.target_boost.maxLevel),
      coin_multiplier: clampInt(
        raw.upgrades?.coin_multiplier,
        SHOP_UPGRADES.coin_multiplier.maxLevel
      ),
    },
    totalCoinsEarnedAllTime,
  };
}

export function readShopState(): ShopSaveState {
  try {
    if (typeof localStorage === 'undefined') {
      return createInitialShopState();
    }
    const raw = localStorage.getItem(SHOP_STORAGE_KEY);
    if (!raw) {
      return createInitialShopState();
    }
    return normalizeShopState(JSON.parse(raw) as Partial<ShopSaveState>);
  } catch {
    return createInitialShopState();
  }
}

export function saveShopState(state: ShopSaveState): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Ignore storage errors
  }
}

export function isSkinUnlocked(state: ShopSaveState, skinId: SkinId): boolean {
  return SKIN_PRICES[skinId] === 0 || state.unlockedSkins.includes(skinId);
}

export function getUpgradePrice(state: ShopSaveState, upgradeId: ShopUpgradeId): number | null {
  const def = SHOP_UPGRADES[upgradeId];
  const lvl = state.upgrades[upgradeId] ?? 0;
  if (lvl >= def.maxLevel) return null;
  return def.prices[lvl];
}

export function getTargetChargeMultiplier(state: ShopSaveState): number {
  return 1 + (state.upgrades.target_boost ?? 0) * 0.1;
}

export function getCoinMultiplier(state: ShopSaveState): number {
  return 1 + (state.upgrades.coin_multiplier ?? 0) * 0.25;
}

export function calculateTargetVictoryCoins(params: {
  level: number;
  combo: number;
  difficulty: DifficultyLevel;
  coinMultiplierLevel: number;
}): number {
  const diffBonus = params.difficulty === 'hard' ? 6 : params.difficulty === 'normal' ? 2 : 0;
  const base =
    12 + Math.max(0, params.level - 1) * 3 + Math.max(0, params.combo - 1) * 3 + diffBonus;
  const mult = 1 + Math.max(0, params.coinMultiplierLevel) * 0.25;
  return Math.max(1, Math.round(base * mult));
}

export function scaleBonusCoins(baseCoins: number, coinMultiplierLevel: number): number {
  const mult = 1 + Math.max(0, coinMultiplierLevel) * 0.25;
  return Math.max(1, Math.round(baseCoins * mult));
}

export function awardCoins(state: ShopSaveState, amount: number): ShopSaveState {
  const clean = Math.max(0, Math.floor(amount));
  if (clean === 0) return state;
  return {
    ...state,
    coins: state.coins + clean,
    totalCoinsEarnedAllTime: state.totalCoinsEarnedAllTime + clean,
  };
}

export function buySkin(
  state: ShopSaveState,
  skinId: SkinId
): { nextState: ShopSaveState; success: boolean } {
  if (isSkinUnlocked(state, skinId)) {
    return { nextState: state, success: true };
  }
  const price = SKIN_PRICES[skinId];
  if (state.coins < price) {
    return { nextState: state, success: false };
  }
  const unlockedSet = new Set<SkinId>(state.unlockedSkins);
  unlockedSet.add(skinId);
  return {
    nextState: {
      ...state,
      coins: state.coins - price,
      unlockedSkins: SKIN_ORDER.filter((id) => unlockedSet.has(id)),
    },
    success: true,
  };
}

export function buyConsumable(
  state: ShopSaveState,
  itemId: ShopConsumableId
): { nextState: ShopSaveState; success: boolean } {
  const def = SHOP_CONSUMABLES[itemId];
  const current = state.consumables[itemId] ?? 0;
  if (current >= def.maxStock || state.coins < def.price) {
    return { nextState: state, success: false };
  }
  return {
    nextState: {
      ...state,
      coins: state.coins - def.price,
      consumables: {
        ...state.consumables,
        [itemId]: current + 1,
      },
    },
    success: true,
  };
}

export function consumeConsumable(state: ShopSaveState, itemId: ShopConsumableId): ShopSaveState {
  const current = state.consumables[itemId] ?? 0;
  if (current <= 0) return state;
  return {
    ...state,
    consumables: {
      ...state.consumables,
      [itemId]: current - 1,
    },
  };
}

export function buyUpgrade(
  state: ShopSaveState,
  upgradeId: ShopUpgradeId
): { nextState: ShopSaveState; success: boolean } {
  const price = getUpgradePrice(state, upgradeId);
  if (price === null || state.coins < price) {
    return { nextState: state, success: false };
  }
  return {
    nextState: {
      ...state,
      coins: state.coins - price,
      upgrades: {
        ...state.upgrades,
        [upgradeId]: (state.upgrades[upgradeId] ?? 0) + 1,
      },
    },
    success: true,
  };
}
