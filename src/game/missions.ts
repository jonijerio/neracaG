import { DifficultyLevel } from './types';

export type SpecialRewardId = 'aura_juara' | 'supernova_fx' | 'master_badge';

export interface SpecialRewardInfo {
  id: SpecialRewardId;
  name: string;
  description: string;
}

export const SPECIAL_REWARDS: Record<SpecialRewardId, SpecialRewardInfo> = {
  aura_juara: {
    id: 'aura_juara',
    name: 'Aura Mahkota Juara',
    description: 'Cincin aura emas berputar dengan kilau berlian di sekitar bola',
  },
  supernova_fx: {
    id: 'supernova_fx',
    name: 'Ledakan Supernova',
    description: 'Gelombang kejut ganda dan ledakan partikel ekstra saat target selesai',
  },
  master_badge: {
    id: 'master_badge',
    name: 'Lencana Master Neraca',
    description: 'Emblem bintang emas terukir di tumpuan neraca dan layar judul',
  },
};

export const SPECIAL_REWARD_ORDER: readonly SpecialRewardId[] = [
  'aura_juara',
  'supernova_fx',
  'master_badge',
];

export type DailyMissionId =
  | 'clear_10_targets'
  | 'level_5_no_powerup'
  | 'combo_5'
  | 'survive_45s'
  | 'score_1500'
  | 'clear_5_hard'
  | 'collect_2_powerups'
  | 'reach_level_4';

export interface RunMissionMetrics {
  targetsCleared: number;
  level: number;
  powerUpsUsed: number;
  maxCombo: number;
  elapsedSeconds: number;
  score: number;
  difficulty: DifficultyLevel;
}

export interface DailyMissionDefinition {
  id: DailyMissionId;
  title: string;
  description: string;
  targetValue: number;
  bonusPoints: number;
  rewardId?: SpecialRewardId;
  requiresNoPowerUp?: boolean;
  requiresDifficulty?: DifficultyLevel;
}

export interface DailyMissionProgress {
  definition: DailyMissionDefinition;
  currentValue: number;
  targetValue: number;
  completed: boolean;
  failedForRun: boolean;
}

export interface DailyMissionSaveState {
  dateKey: string;
  missionIds: DailyMissionId[];
  completedIds: DailyMissionId[];
  totalCompletedAllTime: number;
  unlockedRewards: SpecialRewardId[];
  activeRewards: SpecialRewardId[];
}

export const DAILY_MISSION_POOL: Record<DailyMissionId, DailyMissionDefinition> = {
  clear_10_targets: {
    id: 'clear_10_targets',
    title: 'Penembak Jitu',
    description: 'Selesaikan 10 target dalam 1 permainan',
    targetValue: 10,
    bonusPoints: 350,
    rewardId: 'supernova_fx',
  },
  level_5_no_powerup: {
    id: 'level_5_no_powerup',
    title: 'Keseimbangan Murni',
    description: 'Capai Level 5 tanpa mengambil power-up',
    targetValue: 5,
    bonusPoints: 500,
    rewardId: 'aura_juara',
    requiresNoPowerUp: true,
  },
  combo_5: {
    id: 'combo_5',
    title: 'Rantai Presisi',
    description: 'Capai kombo x5 dalam 1 permainan',
    targetValue: 5,
    bonusPoints: 300,
    rewardId: 'master_badge',
  },
  survive_45s: {
    id: 'survive_45s',
    title: 'Tahan Banting',
    description: 'Bertahan selama 45 detik dalam 1 permainan',
    targetValue: 45,
    bonusPoints: 250,
  },
  score_1500: {
    id: 'score_1500',
    title: 'Kolektor Poin',
    description: 'Raih 1.500 poin dalam 1 permainan',
    targetValue: 1500,
    bonusPoints: 400,
    rewardId: 'supernova_fx',
  },
  clear_5_hard: {
    id: 'clear_5_hard',
    title: 'Ahli Mode Hard',
    description: 'Selesaikan 5 target di tingkat kesulitan Hard',
    targetValue: 5,
    bonusPoints: 450,
    rewardId: 'master_badge',
    requiresDifficulty: 'hard',
  },
  collect_2_powerups: {
    id: 'collect_2_powerups',
    title: 'Pemburu Energi',
    description: 'Ambil 2 power-up dalam 1 permainan',
    targetValue: 2,
    bonusPoints: 250,
  },
  reach_level_4: {
    id: 'reach_level_4',
    title: 'Naik Peringkat',
    description: 'Capai Level 4 dalam 1 permainan',
    targetValue: 4,
    bonusPoints: 300,
    rewardId: 'aura_juara',
  },
};

export const DAILY_MISSION_ORDER: readonly DailyMissionId[] = [
  'clear_10_targets',
  'level_5_no_powerup',
  'combo_5',
  'survive_45s',
  'score_1500',
  'clear_5_hard',
  'collect_2_powerups',
  'reach_level_4',
];

const DAILY_MISSION_STORAGE_KEY = 'neraca_daily_missions_v1';

export function getDailyDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashDateKey(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministically picks 3 distinct daily missions for a given date key.
 * Always pairs at least one signature target/precision challenge with survival/reward variety.
 */
export function selectDailyMissionIds(dateKey: string): DailyMissionId[] {
  let seed = hashDateKey(dateKey);
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Signature pool ensures flagship challenges like clear_10_targets or level_5_no_powerup appear frequently
  const flagship: DailyMissionId[] = ['clear_10_targets', 'level_5_no_powerup', 'combo_5'];
  const firstPick = flagship[Math.floor(nextRand() * flagship.length)];

  const remaining = DAILY_MISSION_ORDER.filter((id) => id !== firstPick);
  // Fisher-Yates shuffle on remaining copy
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = remaining[i];
    remaining[i] = remaining[j];
    remaining[j] = tmp;
  }

  return [firstPick, remaining[0], remaining[1]];
}

export function createDailyMissionSaveState(dateKey = getDailyDateKey()): DailyMissionSaveState {
  return {
    dateKey,
    missionIds: selectDailyMissionIds(dateKey),
    completedIds: [],
    totalCompletedAllTime: 0,
    unlockedRewards: [],
    activeRewards: [],
  };
}

export function normalizeMissionStateForDate(
  saved: Partial<DailyMissionSaveState> | null | undefined,
  todayKey = getDailyDateKey()
): DailyMissionSaveState {
  const validRewards = (arr: unknown): SpecialRewardId[] =>
    Array.isArray(arr)
      ? Array.from(new Set(arr.filter((r): r is SpecialRewardId => typeof r === 'string' && r in SPECIAL_REWARDS)))
      : [];

  const unlockedRewards = validRewards(saved?.unlockedRewards);
  const activeRewards = validRewards(saved?.activeRewards).filter((r) => unlockedRewards.includes(r));
  const totalCompletedAllTime =
    typeof saved?.totalCompletedAllTime === 'number' && Number.isFinite(saved.totalCompletedAllTime)
      ? Math.max(0, Math.floor(saved.totalCompletedAllTime))
      : 0;

  if (saved && saved.dateKey === todayKey && Array.isArray(saved.missionIds) && saved.missionIds.length === 3) {
    const missionIds = saved.missionIds.filter((id): id is DailyMissionId => id in DAILY_MISSION_POOL);
    if (missionIds.length === 3) {
      const completedIds = Array.isArray(saved.completedIds)
        ? Array.from(
            new Set(
              saved.completedIds.filter(
                (id): id is DailyMissionId => missionIds.includes(id as DailyMissionId)
              )
            )
          )
        : [];
      return {
        dateKey: todayKey,
        missionIds,
        completedIds,
        totalCompletedAllTime,
        unlockedRewards,
        activeRewards,
      };
    }
  }

  return {
    dateKey: todayKey,
    missionIds: selectDailyMissionIds(todayKey),
    completedIds: [],
    totalCompletedAllTime,
    unlockedRewards,
    activeRewards,
  };
}

export function readDailyMissionState(todayKey = getDailyDateKey()): DailyMissionSaveState {
  try {
    if (typeof localStorage === 'undefined') {
      return createDailyMissionSaveState(todayKey);
    }
    const raw = localStorage.getItem(DAILY_MISSION_STORAGE_KEY);
    if (!raw) {
      return createDailyMissionSaveState(todayKey);
    }
    const parsed = JSON.parse(raw) as Partial<DailyMissionSaveState>;
    return normalizeMissionStateForDate(parsed, todayKey);
  } catch {
    return createDailyMissionSaveState(todayKey);
  }
}

export function saveDailyMissionState(state: DailyMissionSaveState): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DAILY_MISSION_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function getMissionRunProgress(
  def: DailyMissionDefinition,
  metrics: RunMissionMetrics
): { currentValue: number; failedForRun: boolean; isMet: boolean } {
  if (def.requiresNoPowerUp && metrics.powerUpsUsed > 0) {
    return { currentValue: 0, failedForRun: true, isMet: false };
  }
  if (def.requiresDifficulty && metrics.difficulty !== def.requiresDifficulty) {
    return { currentValue: 0, failedForRun: false, isMet: false };
  }

  let current = 0;
  switch (def.id) {
    case 'clear_10_targets':
    case 'clear_5_hard':
      current = metrics.targetsCleared;
      break;
    case 'level_5_no_powerup':
    case 'reach_level_4':
      current = metrics.level;
      break;
    case 'combo_5':
      current = metrics.maxCombo;
      break;
    case 'survive_45s':
      current = Math.floor(metrics.elapsedSeconds);
      break;
    case 'score_1500':
      current = Math.floor(metrics.score);
      break;
    case 'collect_2_powerups':
      current = metrics.powerUpsUsed;
      break;
  }

  const clamped = Math.min(def.targetValue, Math.max(0, current));
  return {
    currentValue: clamped,
    failedForRun: false,
    isMet: current >= def.targetValue,
  };
}

export function evaluateDailyMissions(
  saveState: DailyMissionSaveState,
  metrics: RunMissionMetrics
): {
  nextState: DailyMissionSaveState;
  newlyCompleted: DailyMissionDefinition[];
  progressList: DailyMissionProgress[];
} {
  const completedSet = new Set<DailyMissionId>(saveState.completedIds);
  const unlockedSet = new Set<SpecialRewardId>(saveState.unlockedRewards);
  const activeSet = new Set<SpecialRewardId>(saveState.activeRewards);
  const newlyCompleted: DailyMissionDefinition[] = [];
  const progressList: DailyMissionProgress[] = [];

  for (const id of saveState.missionIds) {
    const def = DAILY_MISSION_POOL[id];
    if (!def) continue;

    if (completedSet.has(id)) {
      progressList.push({
        definition: def,
        currentValue: def.targetValue,
        targetValue: def.targetValue,
        completed: true,
        failedForRun: false,
      });
      continue;
    }

    const evalRes = getMissionRunProgress(def, metrics);
    if (evalRes.isMet) {
      completedSet.add(id);
      newlyCompleted.push(def);
      if (def.rewardId && !unlockedSet.has(def.rewardId)) {
        unlockedSet.add(def.rewardId);
        activeSet.add(def.rewardId);
      }
      progressList.push({
        definition: def,
        currentValue: def.targetValue,
        targetValue: def.targetValue,
        completed: true,
        failedForRun: false,
      });
    } else {
      progressList.push({
        definition: def,
        currentValue: evalRes.currentValue,
        targetValue: def.targetValue,
        completed: false,
        failedForRun: evalRes.failedForRun,
      });
    }
  }

  if (newlyCompleted.length === 0) {
    return { nextState: saveState, newlyCompleted: [], progressList };
  }

  const nextState: DailyMissionSaveState = {
    ...saveState,
    completedIds: saveState.missionIds.filter((id) => completedSet.has(id)),
    totalCompletedAllTime: saveState.totalCompletedAllTime + newlyCompleted.length,
    unlockedRewards: SPECIAL_REWARD_ORDER.filter((r) => unlockedSet.has(r)),
    activeRewards: SPECIAL_REWARD_ORDER.filter((r) => activeSet.has(r)),
  };

  return { nextState, newlyCompleted, progressList };
}

export function toggleSpecialReward(
  saveState: DailyMissionSaveState,
  rewardId: SpecialRewardId
): DailyMissionSaveState {
  if (!saveState.unlockedRewards.includes(rewardId)) {
    return saveState;
  }
  const isActive = saveState.activeRewards.includes(rewardId);
  const activeRewards = isActive
    ? saveState.activeRewards.filter((r) => r !== rewardId)
    : SPECIAL_REWARD_ORDER.filter((r) => r === rewardId || saveState.activeRewards.includes(r));
  return {
    ...saveState,
    activeRewards,
  };
}
