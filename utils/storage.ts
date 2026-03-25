import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Data Types ───────────────────────────────────────────────

export interface PeriodTime {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface TimetableEntry {
  id: string;
  period: number;        // 何限目 (1-based)
  dayOfWeek: number;     // 曜日 (1=月 ~ 5=金, matching iOS weekday - 2)
  lectureName: string;
  attendanceUrl: string;
  memo: string;
  isEmpty: boolean;      // 空きコマ
  notifyBefore: number;  // 何分前に通知 (default 5)
  notificationId: string | null;
}

export interface Settings {
  maxPeriods: number;         // 最大限数 (1-8)
  periodTimes: PeriodTime[];  // 各時限の開始・終了時刻
  defaultUrl: string;         // デフォルトの出席URL
  notifyBeforeDefault: number; // デフォルト通知分前
}

export interface Memo {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Storage Keys ─────────────────────────────────────────────

const KEYS = {
  TIMETABLE: '@syusseki_timetable',
  SETTINGS: '@syusseki_settings',
  MEMOS: '@syusseki_memos',
};

// ─── Default Values ───────────────────────────────────────────

const DEFAULT_PERIOD_TIMES: ReadonlyArray<PeriodTime> = [
  { startHour: 9, startMinute: 0, endHour: 10, endMinute: 30 },
  { startHour: 10, startMinute: 40, endHour: 12, endMinute: 10 },
  { startHour: 13, startMinute: 0, endHour: 14, endMinute: 30 },
  { startHour: 14, startMinute: 40, endHour: 16, endMinute: 10 },
  { startHour: 16, startMinute: 20, endHour: 17, endMinute: 50 },
  { startHour: 18, startMinute: 0, endHour: 19, endMinute: 30 },
  { startHour: 19, startMinute: 40, endHour: 21, endMinute: 10 },
  { startHour: 21, startMinute: 20, endHour: 22, endMinute: 50 },
];

export function createDefaultSettings(): Settings {
  return {
    maxPeriods: 5,
    periodTimes: DEFAULT_PERIOD_TIMES.map(pt => ({ ...pt })),
    defaultUrl: '',
    notifyBeforeDefault: 5,
  };
}

export const DEFAULT_SETTINGS: Settings = createDefaultSettings();

// ─── Timetable CRUD ───────────────────────────────────────────

export async function getTimetable(): Promise<TimetableEntry[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.TIMETABLE);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveTimetable(entries: TimetableEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.TIMETABLE, JSON.stringify(entries));
}

export async function upsertTimetableEntry(entry: TimetableEntry): Promise<TimetableEntry[]> {
  const entries = await getTimetable();
  const idx = entries.findIndex(e => e.id === entry.id);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  await saveTimetable(entries);
  return entries;
}

export async function deleteTimetableEntry(id: string): Promise<TimetableEntry[]> {
  const entries = await getTimetable();
  const filtered = entries.filter(e => e.id !== id);
  await saveTimetable(filtered);
  return filtered;
}

// ─── Settings CRUD ────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  try {
    const data = await AsyncStorage.getItem(KEYS.SETTINGS);
    const defaults = createDefaultSettings();
    if (data) {
      const parsed = JSON.parse(data) as Partial<Settings>;
      // Merge with defaults for any missing keys, including nested periodTimes
      return {
        ...defaults,
        ...parsed,
        periodTimes: Array.isArray(parsed.periodTimes) && parsed.periodTimes.length > 0
          ? parsed.periodTimes
          : defaults.periodTimes,
      };
    }
    return defaults;
  } catch {
    return createDefaultSettings();
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function resetAllData(): Promise<Settings> {
  const defaults = createDefaultSettings();
  await Promise.all([
    saveSettings(defaults),
    saveTimetable([]),
    saveMemos([]),
  ]);
  return defaults;
}

// ─── Memos CRUD ───────────────────────────────────────────────

export async function getMemos(): Promise<Memo[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.MEMOS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveMemos(memos: Memo[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.MEMOS, JSON.stringify(memos));
}

export async function upsertMemo(memo: Memo): Promise<Memo[]> {
  const memos = await getMemos();
  const idx = memos.findIndex(m => m.id === memo.id);
  if (idx >= 0) {
    memos[idx] = memo;
  } else {
    memos.push(memo);
  }
  await saveMemos(memos);
  return memos;
}

export async function deleteMemo(id: string): Promise<Memo[]> {
  const memos = await getMemos();
  const filtered = memos.filter(m => m.id !== id);
  await saveMemos(filtered);
  return filtered;
}

// ─── Utility ──────────────────────────────────────────────────

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export const DAY_LABELS = ['月', '火', '水', '木', '金'] as const;
export const DAY_LABELS_FULL = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日'] as const;
