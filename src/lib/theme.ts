export type ThemeId = 'light' | 'dark' | 'ocean' | 'forest' | 'sunset' | 'rose';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  swatch: string;
  themeColor: string;
}

export const THEMES: ThemeMeta[] = [
  { id: 'light',  name: 'Light',  swatch: '#8b5cf6', themeColor: '#f4f5f7' },
  { id: 'dark',   name: 'Dark',   swatch: '#8b5cf6', themeColor: '#0a0c0f' },
  { id: 'ocean',  name: 'Ocean',  swatch: '#22d3ee', themeColor: '#0a0e14' },
  { id: 'forest', name: 'Forest', swatch: '#22c55e', themeColor: '#0a100c' },
  { id: 'sunset', name: 'Sunset', swatch: '#f97316', themeColor: '#100c0a' },
  { id: 'rose',   name: 'Rose',   swatch: '#f43f5e', themeColor: '#100a0c' },
];

const STORAGE_KEY = 'np-theme';
const DEFAULT_THEME: ThemeId = 'dark';

const VALID_IDS = new Set<string>(THEMES.map((t) => t.id));

export function getThemeMeta(id: ThemeId): ThemeMeta {
  return THEMES.find((t) => t.id === id) ?? THEMES[1];
}

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_IDS.has(stored)) return stored as ThemeId;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function applyTheme(id: ThemeId): void {
  const meta = getThemeMeta(id);
  document.documentElement.dataset.theme = id;

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', meta.themeColor);
  }

  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
