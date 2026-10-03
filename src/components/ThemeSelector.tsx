import React from 'react';
import { Sun, Moon, Palette, Check, Sparkles, X } from 'lucide-react';
import { ThemeMode, ThemePreset, THEME_PRESETS } from '../services/themeService';

interface ThemeSelectorProps {
  currentMode: ThemeMode;
  currentPreset: ThemePreset;
  onModeChange: (mode: ThemeMode) => void;
  onPresetChange: (preset: ThemePreset) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorProps> = ({
  currentMode,
  currentPreset,
  onModeChange,
  onPresetChange,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border transition-all duration-300 relative overflow-hidden"
        style={{
          background: currentMode === 'light' ? 'rgba(255, 255, 255, 0.98)' : 'rgba(15, 23, 42, 0.96)',
          borderColor: currentMode === 'light' ? 'rgba(217, 119, 6, 0.4)' : 'rgba(245, 158, 11, 0.35)',
          color: currentMode === 'light' ? '#0f172a' : '#f8fafc',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b mb-4" style={{ borderColor: currentMode === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black flex items-center gap-1.5">
                थीम व डिस्प्ले सेटिंग्स
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
              </h3>
              <p className="text-xs opacity-75">प्लेटफॉर्म का रंग व डार्क/लाइट मोड अपनी पसंद से चुनें</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-500/20 transition cursor-pointer"
            aria-label="Close theme selector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Dark Mode / Light Mode Switch */}
        <div className="mb-5">
          <label className="text-xs font-bold uppercase tracking-wider block mb-2 opacity-80">
            मोड चुनें (Light / Dark Mode)
          </label>
          <div className="grid grid-cols-2 gap-2.5 p-1 rounded-2xl bg-black/10 dark:bg-black/30 border border-slate-500/20">
            <button
              type="button"
              onClick={() => onModeChange('light')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
                currentMode === 'light'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-md scale-[1.02]'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-600" />
              <span>☀️ लाइट मोड (दिन)</span>
            </button>
            <button
              type="button"
              onClick={() => onModeChange('dark')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
                currentMode === 'dark'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-md scale-[1.02]'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
              }`}
            >
              <Moon className="w-4 h-4 text-amber-400" />
              <span>🌙 डार्क मोड (रात)</span>
            </button>
          </div>
        </div>

        {/* 2. Color Palettes Grid */}
        <div className="mb-4">
          <label className="text-xs font-bold uppercase tracking-wider block mb-2 opacity-80">
            कलर थीम पैलेट (Theme Preset)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {THEME_PRESETS.map((p) => {
              const isSelected = currentPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPresetChange(p.id)}
                  className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer relative overflow-hidden group ${
                    isSelected
                      ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg scale-[1.02]'
                      : 'border-slate-500/20 hover:border-slate-400/50 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  style={{
                    backgroundColor: currentMode === 'light' ? '#f8fafc' : '#0b1322',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className="w-5 h-5 rounded-full border-2 border-white/60 shadow-sm flex items-center justify-center shrink-0"
                      style={{ backgroundColor: p.accent }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </span>
                    <span 
                      className="h-1.5 w-7 rounded-full bg-gradient-to-r"
                      style={{
                        background: `linear-gradient(90deg, ${p.accent}, transparent)`,
                      }}
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-black block leading-tight truncate">
                      {p.nameHi}
                    </span>
                    <span className="text-[9px] opacity-70 block truncate">
                      {p.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Apply & Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black text-sm shadow-md transition transform active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Check className="w-4 h-4" />
          <span>थीम लागू करें (Apply & Save)</span>
        </button>
      </div>
    </div>
  );
};
