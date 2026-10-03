export type ThemeMode = 'dark' | 'light';

export type ThemePreset = 
  | 'royal-gold' 
  | 'ocean-blue' 
  | 'emerald-green' 
  | 'crimson-ruby' 
  | 'amethyst-purple' 
  | 'midnight-dark';

export interface ThemeConfig {
  id: ThemePreset;
  name: string;
  nameHi: string;
  accent: string;
  gradient: string;
  borderGlow: string;
  previewBg: string;
}

export const THEME_PRESETS: ThemeConfig[] = [
  {
    id: 'royal-gold',
    name: 'Royal Gold & Tiranga',
    nameHi: 'शाही स्वर्ण व तिरंगा',
    accent: '#f59e0b',
    gradient: 'from-amber-400 via-yellow-400 to-amber-600',
    borderGlow: 'rgba(245, 158, 11, 0.4)',
    previewBg: '#090d16',
  },
  {
    id: 'ocean-blue',
    name: 'Sapphire Ocean',
    nameHi: 'नीलम सागर (ओशन ब्लू)',
    accent: '#38bdf8',
    gradient: 'from-sky-400 via-blue-500 to-indigo-600',
    borderGlow: 'rgba(56, 189, 248, 0.4)',
    previewBg: '#071326',
  },
  {
    id: 'emerald-green',
    name: 'Vedic Emerald',
    nameHi: 'वैदिक पन्ना (हरा)',
    accent: '#10b981',
    gradient: 'from-emerald-400 via-green-500 to-teal-600',
    borderGlow: 'rgba(16, 185, 129, 0.4)',
    previewBg: '#061a12',
  },
  {
    id: 'crimson-ruby',
    name: 'Regal Ruby',
    nameHi: 'माणिक्य रूबी (लाल/गुलाबी)',
    accent: '#f43f5e',
    gradient: 'from-rose-400 via-red-500 to-pink-600',
    borderGlow: 'rgba(244, 63, 94, 0.4)',
    previewBg: '#1c0a12',
  },
  {
    id: 'amethyst-purple',
    name: 'Imperial Amethyst',
    nameHi: 'शाही जामुनी (पर्पल)',
    accent: '#a855f7',
    gradient: 'from-purple-400 via-violet-500 to-fuchsia-600',
    borderGlow: 'rgba(168, 85, 247, 0.4)',
    previewBg: '#140824',
  },
  {
    id: 'midnight-dark',
    name: 'Obsidian Jet',
    nameHi: 'मिडनाइट ओब्सीडियन',
    accent: '#e2e8f0',
    gradient: 'from-slate-200 via-slate-400 to-zinc-600',
    borderGlow: 'rgba(226, 232, 240, 0.3)',
    previewBg: '#020205',
  },
];

const STORAGE_MODE_KEY = 'iois_theme_mode';
const STORAGE_PRESET_KEY = 'iois_theme_preset';

export const getSavedThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem(STORAGE_MODE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark'; // Default luxury dark
};

export const getSavedThemePreset = (): ThemePreset => {
  if (typeof window === 'undefined') return 'royal-gold';
  const saved = localStorage.getItem(STORAGE_PRESET_KEY);
  if (saved && THEME_PRESETS.some((p) => p.id === saved)) return saved as ThemePreset;
  return 'royal-gold';
};

export const applyThemeToDocument = (mode: ThemeMode, preset: ThemePreset) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // 1. Remove previous classes
  root.classList.remove('dark', 'light');
  THEME_PRESETS.forEach((p) => root.classList.remove(`theme-${p.id}`));

  // 2. Add current mode and preset
  root.classList.add(mode);
  root.classList.add(`theme-${preset}`);
  root.setAttribute('data-theme', preset);
  root.setAttribute('data-mode', mode);

  // 3. Save to localStorage
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
    localStorage.setItem(STORAGE_PRESET_KEY, preset);
  } catch (e) {}

  // 4. Update browser theme-color meta tag
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    if (mode === 'light') {
      metaTheme.setAttribute('content', '#f8fafc');
    } else {
      const activePreset = THEME_PRESETS.find((p) => p.id === preset);
      metaTheme.setAttribute('content', activePreset?.previewBg || '#020617');
    }
  }
};
