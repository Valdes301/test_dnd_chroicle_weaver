/**
 * Gestione degli sfondi personalizzati per:
 * 1. Schermata Principale (Main App Layout)
 * 2. Bacheca della Taverna (Dashboard / Hub)
 * 3. Schermata di Inserimento PIN (Lock Screen)
 */

export type BackgroundTarget = 'main' | 'dashboard' | 'pin';

export interface BackgroundConfig {
  type: 'preset' | 'custom_url' | 'custom_file';
  presetId?: string;
  customUrl?: string;
  opacity: number; // 0.1 - 1.0
  overlayDarkness: number; // 0.0 - 0.95 (livello di overlay scuro per leggibilità)
  blur: number; // 0 - 20 (px)
  textureOverlay?: 'none' | 'runic' | 'dots' | 'grid' | 'vignette';
}

export interface BackgroundSettings {
  main: BackgroundConfig;
  dashboard: BackgroundConfig;
  pin: BackgroundConfig;
}

export interface PresetBackground {
  id: string;
  name: string;
  category: string;
  description: string;
  previewGradient: string;
  imageUrl?: string;
  cssBackground?: string;
  defaultOpacity?: number;
  defaultOverlayDarkness?: number;
}

export const PRESETS_MAIN: PresetBackground[] = [
  {
    id: 'default',
    name: 'Taverna del Viandante (Predefinito)',
    category: 'Taverna',
    description: 'Ambiente caldo e accogliente da locanda fantasy con camino e travi in legno.',
    previewGradient: 'radial-gradient(ellipse at center, #3d2410 0%, #150d06 100%)',
    imageUrl: '/hero-dnd-bg.jpg',
    defaultOpacity: 0.35,
    defaultOverlayDarkness: 0.55
  },
  {
    id: 'parchment_dark',
    name: 'Pergamena Arcana',
    category: 'Fantasy',
    description: 'Texture autentica di pergamena antica trattata per sessioni narrative.',
    previewGradient: 'radial-gradient(ellipse at center, #2e2013 0%, #140d07 100%)',
    imageUrl: '/handout-background.jpg',
    defaultOpacity: 0.3,
    defaultOverlayDarkness: 0.65
  },
  {
    id: 'grimoire_ancient',
    name: 'Grimorio dei Segreti',
    category: 'Arcano',
    description: 'Copertina di antico tomo di magie e cronache sigillato.',
    previewGradient: 'radial-gradient(ellipse at center, #362215 0%, #120c08 100%)',
    imageUrl: '/ancient-grimoire-bg.jpg',
    defaultOpacity: 0.3,
    defaultOverlayDarkness: 0.65
  },
  {
    id: 'tavern_wood_table',
    name: 'Tavolo di Quercia Antica',
    category: 'Taverna',
    description: 'Tavolato di legno massiccio da locanda con venature calde.',
    previewGradient: 'radial-gradient(circle, #3d2212 0%, #160f0a 100%)',
    imageUrl: '/tavern-board-bg.jpg',
    defaultOpacity: 0.35,
    defaultOverlayDarkness: 0.6
  },
  {
    id: 'crypt_stone',
    name: 'Pietra di Cripta Gotica',
    category: 'Classico',
    description: 'Tonalità scura profonda e neutra con sfumatura d\'ossidiana.',
    previewGradient: 'linear-gradient(to bottom, #171513, #0f0d0c)',
    cssBackground: 'linear-gradient(to bottom, #141210 0%, #0a0908 100%)',
    defaultOpacity: 1.0,
    defaultOverlayDarkness: 0.2
  }
];

export const PRESETS_DASHBOARD: PresetBackground[] = [
  {
    id: 'default',
    name: 'Tavolo di Legno & Bacheca Taverna (Predefinito)',
    category: 'Taverna',
    description: 'Il classico tagliere e bacheca di legno antico della locanda.',
    previewGradient: 'radial-gradient(circle, #3d2212 0%, #160f0a 100%)',
    imageUrl: '/tavern-board-bg.jpg',
    defaultOpacity: 0.75,
    defaultOverlayDarkness: 0.35
  },
  {
    id: 'tavern_hall',
    name: 'Sala Comune della Taverna',
    category: 'Atmosfera',
    description: 'Tavoli di quercia illuminati dal focolare e candele calde.',
    previewGradient: 'radial-gradient(ellipse at center, #3d2410 0%, #150d06 100%)',
    imageUrl: '/hero-dnd-bg.jpg',
    defaultOpacity: 0.6,
    defaultOverlayDarkness: 0.45
  },
  {
    id: 'ancient_grimoire_wood',
    name: 'Tavolo del Grimorio',
    category: 'Arcano',
    description: 'Antico tomo rilegato in cuoio su legno scuro.',
    previewGradient: 'radial-gradient(circle, #362215 0%, #120c08 100%)',
    imageUrl: '/ancient-grimoire-bg.jpg',
    defaultOpacity: 0.65,
    defaultOverlayDarkness: 0.4
  },
  {
    id: 'parchment_board',
    name: 'Bacheca in Pergamena',
    category: 'Pergamena',
    description: 'Fogli di pergamena ingiallita per affiggere missioni e taglie.',
    previewGradient: 'radial-gradient(ellipse at center, #2e2013 0%, #140d07 100%)',
    imageUrl: '/handout-background.jpg',
    defaultOpacity: 0.55,
    defaultOverlayDarkness: 0.5
  }
];

export const PRESETS_PIN: PresetBackground[] = [
  {
    id: 'default',
    name: 'Antico Libro Chiuso & Grimorio (Predefinito)',
    category: 'Grimorio',
    description: 'Antico tomo in cuoio con fermagli in metallo cesellato e rune protettive.',
    previewGradient: 'radial-gradient(circle at center, #362215 0%, #120c08 70%, #000000 100%)',
    imageUrl: '/ancient-grimoire-bg.jpg',
    defaultOpacity: 0.85,
    defaultOverlayDarkness: 0.35
  },
  {
    id: 'tavern_night',
    name: 'Taverna a Tarda Notte',
    category: 'Taverna',
    description: 'Atmosfera intima e silenziosa della locanda dopo la chiusura.',
    previewGradient: 'radial-gradient(ellipse at center, #3d2410 0%, #150d06 100%)',
    imageUrl: '/hero-dnd-bg.jpg',
    defaultOpacity: 0.6,
    defaultOverlayDarkness: 0.5
  },
  {
    id: 'board_wood_lock',
    name: 'Tavolo di Quercia Sigillato',
    category: 'Legno',
    description: 'Tavola massiccia con riflessi ambrati e ombra protettiva.',
    previewGradient: 'radial-gradient(circle at center, #3d2212 0%, #160f0a 100%)',
    imageUrl: '/tavern-board-bg.jpg',
    defaultOpacity: 0.7,
    defaultOverlayDarkness: 0.45
  },
  {
    id: 'golden_seal',
    name: 'Sigillo Aureo Runico',
    category: 'Arcano',
    description: 'Sfondo radiale con bagliori dorati e cerchi di protezione.',
    previewGradient: 'radial-gradient(circle at center, #26170a 0%, #0c0805 70%, #000000 100%)',
    cssBackground: 'radial-gradient(circle at center, rgba(38, 23, 10, 0.85) 0%, rgba(12, 8, 5, 0.95) 70%, rgba(0, 0, 0, 0.98) 100%)',
    defaultOpacity: 1.0,
    defaultOverlayDarkness: 0.15
  }
];

const STORAGE_KEY = 'dnd_master_background_settings';

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  main: {
    type: 'preset',
    presetId: 'default',
    opacity: 0.35,
    overlayDarkness: 0.55,
    blur: 0,
    textureOverlay: 'vignette'
  },
  dashboard: {
    type: 'preset',
    presetId: 'default',
    opacity: 0.75,
    overlayDarkness: 0.35,
    blur: 0,
    textureOverlay: 'vignette'
  },
  pin: {
    type: 'preset',
    presetId: 'default',
    opacity: 0.85,
    overlayDarkness: 0.35,
    blur: 0,
    textureOverlay: 'dots'
  }
};

export function getBackgroundSettings(): BackgroundSettings {
  if (typeof window === 'undefined') return DEFAULT_BACKGROUND_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BACKGROUND_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      main: { ...DEFAULT_BACKGROUND_SETTINGS.main, ...(parsed.main || {}) },
      dashboard: { ...DEFAULT_BACKGROUND_SETTINGS.dashboard, ...(parsed.dashboard || {}) },
      pin: { ...DEFAULT_BACKGROUND_SETTINGS.pin, ...(parsed.pin || {}) },
    };
  } catch {
    return DEFAULT_BACKGROUND_SETTINGS;
  }
}

export function saveBackgroundSettings(settings: BackgroundSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('dnd-backgrounds-changed', { detail: settings }));
  } catch (err) {
    console.error("Failed to save background settings", err);
  }
}

export function updateBackgroundConfig(target: BackgroundTarget, updates: Partial<BackgroundConfig>): BackgroundSettings {
  const current = getBackgroundSettings();
  const next: BackgroundSettings = {
    ...current,
    [target]: {
      ...current[target],
      ...updates
    }
  };
  saveBackgroundSettings(next);
  return next;
}

export function resetBackgroundTarget(target: BackgroundTarget): BackgroundSettings {
  const current = getBackgroundSettings();
  const next: BackgroundSettings = {
    ...current,
    [target]: { ...DEFAULT_BACKGROUND_SETTINGS[target] }
  };
  saveBackgroundSettings(next);
  return next;
}

export function resetAllBackgrounds(): BackgroundSettings {
  saveBackgroundSettings(DEFAULT_BACKGROUND_SETTINGS);
  return DEFAULT_BACKGROUND_SETTINGS;
}

/**
 * Normalizza gli URL degli sfondi: se un URL memorizzato in precedenza fa riferimento
 * a '/api/assets/<preset>' per uno dei file precaricati, lo converte automaticamente al
 * percorso statico diretto '/<preset>', immediatamente accessibile dal server web senza API.
 */
export function normalizeBackgroundUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const staticPresetMap: Record<string, string> = {
    'hero-dnd-bg.jpg': '/hero-dnd-bg.jpg',
    'tavern-board-bg.jpg': '/tavern-board-bg.jpg',
    'ancient-grimoire-bg.jpg': '/ancient-grimoire-bg.jpg',
    'handout-background.jpg': '/handout-background.jpg',
    'card-background.jpg': '/card-background.jpg',
    'card-back-magie.jpg': '/card-back-magie.jpg',
    'card-back-oggetti.jpg': '/card-back-oggetti.jpg',
  };

  for (const [filename, staticPath] of Object.entries(staticPresetMap)) {
    if (url.includes(filename)) {
      return staticPath;
    }
  }
  return url;
}

export function resolveBackgroundStyle(target: BackgroundTarget, config: BackgroundConfig): {
  backgroundImage?: string;
  backgroundColor?: string;
  opacity: number;
  filter?: string;
  overlayStyle?: React.CSSProperties;
} {
  let bgImage: string | undefined = undefined;
  let bgCss: string | undefined = undefined;

  if (config.type === 'custom_url' || config.type === 'custom_file') {
    if (config.customUrl) {
      const normalized = normalizeBackgroundUrl(config.customUrl);
      if (normalized && normalized.startsWith('/') && !normalized.startsWith('/api/assets/')) {
        const fn = normalized.replace(/^\//, '');
        bgImage = `url("${normalized}"), url("/api/assets/${fn}")`;
      } else {
        bgImage = `url("${normalized}")`;
      }
    }
  } else {
    // Preset
    const presets = target === 'main' ? PRESETS_MAIN : target === 'dashboard' ? PRESETS_DASHBOARD : PRESETS_PIN;
    const preset = presets.find(p => p.id === config.presetId) || presets[0];
    if (preset.imageUrl) {
      const normalized = normalizeBackgroundUrl(preset.imageUrl);
      if (normalized && normalized.startsWith('/') && !normalized.startsWith('/api/assets/')) {
        const fn = normalized.replace(/^\//, '');
        bgImage = `url("${normalized}"), url("/api/assets/${fn}")`;
      } else {
        bgImage = `url("${normalized}")`;
      }
    } else if (preset.cssBackground) {
      bgCss = preset.cssBackground;
    }
  }

  // Fallback garantiti per ogni target se per qualsiasi motivo l'immagine non fosse risolta
  if (!bgImage && !bgCss) {
    if (target === 'main') bgImage = `url("/hero-dnd-bg.jpg"), url("/api/assets/hero-dnd-bg.jpg")`;
    else if (target === 'dashboard') bgImage = `url("/tavern-board-bg.jpg"), url("/api/assets/tavern-board-bg.jpg")`;
    else if (target === 'pin') bgImage = `url("/ancient-grimoire-bg.jpg"), url("/api/assets/ancient-grimoire-bg.jpg")`;
  }

  const filter = config.blur > 0 ? `blur(${config.blur}px)` : undefined;

  return {
    backgroundImage: bgImage || bgCss,
    opacity: config.opacity,
    filter,
  };
}
